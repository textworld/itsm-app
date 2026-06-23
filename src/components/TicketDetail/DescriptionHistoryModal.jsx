import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, List, Modal, Select, Space, Tag, Typography } from 'antd';
import RichContentPreview from '../common/RichContentPreview.jsx';
import { buildDescriptionDiff, getHistoryEntryByVersion } from '../../utils/descriptionHistory.js';
import { formatDateTime } from '../../utils/format.js';

export default function DescriptionHistoryModal({ ticket, open, onClose }) {
  const history = useMemo(
    () => [...(ticket?.descriptionHistory || [])].sort((left, right) => right.version - left.version),
    [ticket?.descriptionHistory]
  );
  const latestVersion = history[0]?.version || 1;
  const previousVersion = history[1]?.version || history[0]?.version || 1;
  const [leftVersion, setLeftVersion] = useState(previousVersion);
  const [rightVersion, setRightVersion] = useState(latestVersion);

  React.useEffect(() => {
    if (!open) return;
    setLeftVersion(previousVersion);
    setRightVersion(latestVersion);
  }, [latestVersion, open, previousVersion, ticket?.id]);

  const leftEntry = getHistoryEntryByVersion(history, leftVersion);
  const rightEntry = getHistoryEntryByVersion(history, rightVersion);
  const diffSegments = useMemo(
    () => buildDescriptionDiff(leftEntry?.description, rightEntry?.description),
    [leftEntry?.description, rightEntry?.description]
  );

  const versionOptions = history.map((entry) => ({
    label: `V${entry.version} · ${formatDateTime(entry.editedAt)}`,
    value: entry.version
  }));

  const handleCompareWithPrevious = (entry) => {
    if (!entry) return;
    const previous = getHistoryEntryByVersion(history, entry.version - 1);
    setLeftVersion(previous?.version || entry.version);
    setRightVersion(entry.version);
  };

  return (
    <Modal
      title="工单描述历史"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1080}
      destroyOnClose
    >
      {!history.length ? (
        <Empty description="暂无历史记录" />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="历史记录说明"
            description="支持查看每次描述修改记录；可直接查看某版本与上一版差异，也可自由选择任意两个版本进行对比。"
          />

          <Card title="版本记录" size="small">
            <List
              dataSource={history}
              renderItem={(entry) => (
                <List.Item
                  actions={[
                    <Button key="preview" size="small" onClick={() => {
                      setLeftVersion(entry.version);
                      setRightVersion(entry.version);
                    }}>
                      查看版本
                    </Button>,
                    <Button
                      key="diff-prev"
                      size="small"
                      disabled={entry.version <= 1}
                      onClick={() => handleCompareWithPrevious(entry)}
                    >
                      与上版差异
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={(
                      <Space wrap>
                        <Tag color="blue">V{entry.version}</Tag>
                        <Typography.Text>{entry.reason || '工单描述修改'}</Typography.Text>
                      </Space>
                    )}
                    description={(
                      <Space size="middle" wrap>
                        <Typography.Text type="secondary">
                          修改人：{entry.editorName}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          时间：{formatDateTime(entry.editedAt)}
                        </Typography.Text>
                      </Space>
                    )}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="任意版本对比" size="small">
            <Space wrap style={{ marginBottom: 16 }}>
              <Select
                style={{ width: 240 }}
                value={leftVersion}
                options={versionOptions}
                onChange={setLeftVersion}
                placeholder="选择基准版本"
              />
              <Typography.Text>对比</Typography.Text>
              <Select
                style={{ width: 240 }}
                value={rightVersion}
                options={versionOptions}
                onChange={setRightVersion}
                placeholder="选择目标版本"
              />
            </Space>

            <Space align="start" size="large" style={{ width: '100%' }}>
              <Card
                size="small"
                title={leftEntry ? `基准版本 V${leftEntry.version}` : '基准版本'}
                style={{ flex: 1, minWidth: 0 }}
              >
                {leftEntry ? (
                  <>
                    <Typography.Text type="secondary">
                      {leftEntry.editorName} · {formatDateTime(leftEntry.editedAt)}
                    </Typography.Text>
                    <div style={{ marginTop: 12 }}>
                      <RichContentPreview
                        className="ticket-rich-description"
                        doc={leftEntry.descriptionDoc}
                        html={leftEntry.descriptionHtml}
                        text={leftEntry.description}
                      />
                    </div>
                  </>
                ) : (
                  <Empty description="未选择版本" />
                )}
              </Card>

              <Card
                size="small"
                title={rightEntry ? `目标版本 V${rightEntry.version}` : '目标版本'}
                style={{ flex: 1, minWidth: 0 }}
              >
                {rightEntry ? (
                  <>
                    <Typography.Text type="secondary">
                      {rightEntry.editorName} · {formatDateTime(rightEntry.editedAt)}
                    </Typography.Text>
                    <div style={{ marginTop: 12 }}>
                      <RichContentPreview
                        className="ticket-rich-description"
                        doc={rightEntry.descriptionDoc}
                        html={rightEntry.descriptionHtml}
                        text={rightEntry.description}
                      />
                    </div>
                  </>
                ) : (
                  <Empty description="未选择版本" />
                )}
              </Card>
            </Space>

            <Card title="文本差异" size="small" style={{ marginTop: 16 }}>
              {leftEntry && rightEntry ? (
                rightEntry.version === leftEntry.version ? (
                  <Typography.Text type="secondary">
                    当前选择的是同一版本，可直接上方查看该次描述内容。
                  </Typography.Text>
                ) : (
                  <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                    {diffSegments.map((segment) => (
                      <span
                        key={segment.id}
                        style={segmentStyle(segment.type)}
                      >
                        {segment.value}
                      </span>
                    ))}
                  </Typography.Paragraph>
                )
              ) : (
                <Empty description="请选择两个版本进行对比" />
              )}
            </Card>
          </Card>
        </Space>
      )}
    </Modal>
  );
}

function segmentStyle(type) {
  if (type === 'add') {
    return {
      background: '#f6ffed',
      color: '#389e0d'
    };
  }

  if (type === 'remove') {
    return {
      background: '#fff1f0',
      color: '#cf1322',
      textDecoration: 'line-through'
    };
  }

  return {};
}
