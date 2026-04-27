'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { EVENTS } from '../state-machine/ticketStateMachine.js';

const TicketContext = createContext(null);

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

function replaceTicketInList(list, ticket, previousId = ticket.id) {
  const replacedIds = new Set([ticket.id, previousId].filter(Boolean));
  const nextList = list.filter((item) => !replacedIds.has(item.id));
  return [ticket, ...nextList];
}

export function TicketProvider({ children }) {
  const { user, initialized: authInitialized } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [defects, setDefects] = useState([]);
  const [messageReads, setMessageReads] = useState({});

  const refreshData = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setDefects([]);
      setMessageReads({});
      return {
        tickets: [],
        defects: [],
        messageReads: {}
      };
    }

    const { response, data } = await requestJson('/api/data');
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.reason || '加载工单数据失败');
    }

    setTickets(data.tickets || []);
    setDefects(data.defects || []);
    setMessageReads(data.messageReads || {});
    return data;
  }, [user]);

  useEffect(() => {
    let active = true;

    if (!authInitialized) {
      return undefined;
    }

    setInitialized(false);

    (async () => {
      try {
        if (!user) {
          if (!active) return;
          setTickets([]);
          setDefects([]);
          setMessageReads({});
          return;
        }

        const data = await refreshData();
        if (!active) return;
        setTickets(data.tickets || []);
        setDefects(data.defects || []);
        setMessageReads(data.messageReads || {});
      } catch (error) {
        if (active) {
          console.error(error);
          setTickets([]);
          setDefects([]);
          setMessageReads({});
        }
      } finally {
        if (active) {
          setInitialized(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [authInitialized, refreshData, user]);

  const addTicket = useCallback(async (ticket, event = EVENTS.SUBMIT) => {
    const { response, data } = await requestJson('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ ticket, event })
    });

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.reason || (event === EVENTS.CREATE_DRAFT ? '暂存草稿失败' : '新建工单失败'));
    }

    setTickets((prev) => replaceTicketInList(prev, data.ticket));
    return data.ticket;
  }, []);

  const createDraft = useCallback(
    (ticket) => addTicket(ticket, EVENTS.CREATE_DRAFT),
    [addTicket]
  );

  const updateTicket = useCallback(async () => {
    throw new Error('请使用 dispatchEvent 通过状态机事件修改工单');
  }, []);

  const dispatchEvent = useCallback(async (ticketId, event, payload = {}) => {
    try {
      const { response, data } = await requestJson(`/api/tickets/${ticketId}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({ event, payload })
      });

      if (!response.ok || data?.ok === false) {
        return { ok: false, reason: data?.reason || '状态流转失败' };
      }

      setTickets((prev) => replaceTicketInList(prev, data.ticket, ticketId));
      return { ok: true, ticket: data.ticket };
    } catch (error) {
      console.error(error);
      return { ok: false, reason: error.message || '状态流转失败' };
    }
  }, []);

  const addMessage = useCallback(async (ticketId, message) => {
    const { response, data } = await requestJson(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.reason || '留言发送失败');
    }

    setTickets((prev) => replaceTicketInList(prev, data.ticket));
    return data.ticket;
  }, []);

  const markMessagesRead = useCallback(async (ticketId, userId, readAt = new Date().toISOString()) => {
    if (!ticketId || !userId) return;

    setMessageReads((prev) => ({
      ...prev,
      [`${userId}:${ticketId}`]: readAt
    }));

    try {
      await requestJson('/api/message-reads', {
        method: 'POST',
        body: JSON.stringify({ ticketId, readAt })
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  const addDefect = useCallback(async (defect) => {
    const { response, data } = await requestJson('/api/defects', {
      method: 'POST',
      body: JSON.stringify({ defect })
    });

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.reason || '创建缺陷失败');
    }

    setDefects((prev) => [data.defect, ...prev.filter((item) => item.defectId !== data.defect.defectId)]);
    return data.defect;
  }, []);

  const resetData = useCallback(async () => {
    const { response, data } = await requestJson('/api/reset', {
      method: 'POST'
    });

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.reason || '初始化数据失败');
    }

    await refreshData();
  }, [refreshData]);

  const exportData = useCallback(async () => {
    const response = await fetch('/api/export', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('导出失败');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const matched = disposition.match(/filename="([^"]+)"/);
    const filename = matched?.[1] || 'itsm-tickets-export.json';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return filename;
  }, []);

  const value = useMemo(
    () => ({
      initialized,
      tickets,
      defects,
      messageReads,
      addTicket,
      createDraft,
      updateTicket,
      addMessage,
      markMessagesRead,
      addDefect,
      dispatchEvent,
      resetData,
      exportData,
      refreshData
    }),
    [
      initialized,
      tickets,
      defects,
      messageReads,
      addTicket,
      createDraft,
      updateTicket,
      addMessage,
      markMessagesRead,
      addDefect,
      dispatchEvent,
      resetData,
      exportData,
      refreshData
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
