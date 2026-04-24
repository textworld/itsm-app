import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  bootstrapStorage,
  exportTicketsAsJson,
  loadDefects,
  loadMessageReads,
  loadTickets,
  resetAllData,
  saveDefects,
  saveMessageReads,
  saveTickets
} from '../utils/storage.js';
import {
  applyTransition as smApplyTransition,
  canTransition as smCanTransition
} from '../state-machine/ticketStateMachine.js';

const TicketContext = createContext(null);

/**
 * TicketProvider
 * - 维护内存中的工单与缺陷池，任何 mutate 操作都会同步到 localStorage
 * - 暴露 addTicket / updateTicket / addMessage / dispatchEvent 等常用方法
 * - 暴露 resetData / exportData 供列表页 DataActionBar 调用
 */
export function TicketProvider({ children }) {
  // 启动时幂等初始化（若 key 不存在则写入 initialTickets.json）
  const [initialized, setInitialized] = useState(false);
  const [tickets, setTicketsState] = useState([]);
  const [defects, setDefectsState] = useState([]);
  const [messageReads, setMessageReads] = useState({});

  useEffect(() => {
    bootstrapStorage();
    setTicketsState(loadTickets());
    setDefectsState(loadDefects());
    setMessageReads(loadMessageReads());
    setInitialized(true);
  }, []);

  // 自动持久化
  useEffect(() => {
    if (!initialized) return;
    saveTickets(tickets);
  }, [tickets, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveDefects(defects);
  }, [defects, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveMessageReads(messageReads);
  }, [messageReads, initialized]);

  /** 新增工单 */
  const addTicket = useCallback((ticket) => {
    setTicketsState((prev) => [ticket, ...prev]);
  }, []);

  /** 按 id 更新工单（传入新工单对象或更新函数） */
  const updateTicket = useCallback((id, updaterOrTicket) => {
    setTicketsState((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return typeof updaterOrTicket === 'function'
          ? updaterOrTicket(t)
          : { ...t, ...updaterOrTicket };
      })
    );
  }, []);

  /**
   * 触发工单状态机事件
   * @param {string} ticketId
   * @param {string} event
   * @param {object} payload  业务字段(将并入工单)
   * @param {object} user     操作用户 { id, name, role }
   * @returns {{ok: boolean, reason?: string, ticket?: object}}
   */
  const dispatchEvent = useCallback((ticketId, event, payload = {}, user) => {
    let result = { ok: false, reason: '工单不存在' };
    setTicketsState((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const check = smCanTransition(t, event, user, payload);
        if (!check.ok) {
          result = { ok: false, reason: check.reason };
          return t;
        }
        try {
          const next = smApplyTransition(t, event, payload, user);
          result = { ok: true, ticket: next };
          return next;
        } catch (err) {
          result = { ok: false, reason: err.message };
          return t;
        }
      })
    );
    return result;
  }, []);

  /** 追加留言（不改变状态） */
  const addMessage = useCallback(
    (ticketId, message) => {
      updateTicket(ticketId, (t) => ({
        ...t,
        messages: [...(t.messages || []), message],
        updatedAt: new Date().toISOString()
      }));
    },
    [updateTicket]
  );

  const markMessagesRead = useCallback((ticketId, userId, readAt = new Date().toISOString()) => {
    if (!ticketId || !userId) return;
    const key = `${userId}:${ticketId}`;
    setMessageReads((prev) => ({
      ...prev,
      [key]: readAt
    }));
  }, []);

  /** 新建缺陷并入库，返回新缺陷对象 */
  const addDefect = useCallback((defect) => {
    setDefectsState((prev) => [defect, ...prev]);
    return defect;
  }, []);

  /** 重置工单与缺陷为初始 json 数据 */
  const resetData = useCallback(() => {
    resetAllData();
    setTicketsState(loadTickets());
    setDefectsState(loadDefects());
  }, []);

  /** 导出工单数据为 json 文件 */
  const exportData = useCallback(() => {
    return exportTicketsAsJson();
  }, []);

  const value = useMemo(
    () => ({
      initialized,
      tickets,
      defects,
      messageReads,
      addTicket,
      updateTicket,
      addMessage,
      markMessagesRead,
      addDefect,
      dispatchEvent,
      resetData,
      exportData
    }),
    [
      initialized,
      tickets,
      defects,
      messageReads,
      addTicket,
      updateTicket,
      addMessage,
      markMessagesRead,
      addDefect,
      dispatchEvent,
      resetData,
      exportData
    ]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export function useTickets() {
  const ctx = useContext(TicketContext);
  if (!ctx) {
    throw new Error('useTickets 必须在 <TicketProvider> 内使用');
  }
  return ctx;
}
