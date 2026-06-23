import React from 'react';
import { Space, Button, Popconfirm, App as AntdApp } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTickets } from '../../context/TicketContext.jsx';

/**
 * 数据操作栏：初始化数据 + 导出数据
 * 业务说明：
 * - "初始化数据"：将 SQLite 中的工单/缺陷覆盖为 mock 初始 json
 * - "导出数据"：将 SQLite 中的工单导出为 json 文件
 */
export default function DataActionBar({ style }) {
  const { resetData, exportData } = useTickets();
  const { message } = AntdApp.useApp();

  const handleReset = async () => {
    try {
      await resetData();
      message.success('已将工单数据重置为初始值');
    } catch (error) {
      console.error(error);
      message.error('初始化数据失败');
    }
  };

  const handleExport = async () => {
    try {
      const filename = await exportData();
      message.success(`已导出：${filename}`);
    } catch (error) {
      console.error(error);
      message.error('导出失败');
    }
  };

  return (
    <Space style={style} wrap>
      <Popconfirm
        title="确定要初始化数据吗？"
        description="这会用 mock 初始数据覆盖 SQLite 中的工单与缺陷池，已有的修改将丢失。"
        okText="确认初始化"
        cancelText="取消"
        onConfirm={handleReset}
      >
        <Button icon={<ReloadOutlined />}>初始化数据</Button>
      </Popconfirm>
      <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
        导出数据
      </Button>
    </Space>
  );
}
