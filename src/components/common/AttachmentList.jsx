import React from 'react';
import { List, Button, Space, Typography, Image } from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FileZipOutlined,
  PaperClipOutlined
} from '@ant-design/icons';

export default function AttachmentList({ attachments = [], compact = false }) {
  if (!attachments.length) {
    return <Typography.Text type="secondary">无附件</Typography.Text>;
  }

  return (
    <List
      size="small"
      dataSource={attachments}
      renderItem={(attachment) => {
        const fileVisual = getAttachmentVisual(attachment);

        return (
          <List.Item
            style={{ padding: compact ? '6px 0' : '10px 0' }}
            actions={[
              <a
                key="download"
                href={attachment.url || attachment.base64}
                download={attachment.name}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Button type="link" size="small" icon={<DownloadOutlined />}>
                  下载
                </Button>
              </a>
            ]}
          >
            <Space align="start" size={12} className="attachment-list-item">
              {fileVisual.kind === 'image' ? (
                <Image
                  className="attachment-thumb"
                  width={compact ? 44 : 56}
                  height={compact ? 44 : 56}
                  src={attachment.url || attachment.base64}
                  alt={attachment.name}
                  preview={{ mask: '预览' }}
                />
              ) : (
                <span className={`attachment-file-icon attachment-file-icon-${fileVisual.tone}`}>
                  <fileVisual.Icon />
                </span>
              )}
              <Space direction="vertical" size={2}>
                <Typography.Text>{attachment.name}</Typography.Text>
                <Typography.Text type="secondary">{fileVisual.label}</Typography.Text>
                {attachment.uploader && (
                  <Typography.Text type="secondary">上传人：{attachment.uploader}</Typography.Text>
                )}
              </Space>
            </Space>
          </List.Item>
        );
      }}
    />
  );
}

function getAttachmentVisual(attachment) {
  const fileType = (attachment?.type || '').toLowerCase();
  const fileName = (attachment?.name || '').toLowerCase();

  if (fileType.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(fileName)) {
    return { kind: 'image', label: '图片文件' };
  }

  if (/\.(doc|docx)$/.test(fileName)) {
    return { kind: 'file', Icon: FileWordOutlined, tone: 'word', label: 'Word 文档' };
  }

  if (/\.(xls|xlsx|csv)$/.test(fileName)) {
    return { kind: 'file', Icon: FileExcelOutlined, tone: 'excel', label: 'Excel 表格' };
  }

  if (/\.(ppt|pptx)$/.test(fileName)) {
    return { kind: 'file', Icon: FilePptOutlined, tone: 'ppt', label: 'PPT 演示文稿' };
  }

  if (/\.pdf$/.test(fileName) || fileType === 'application/pdf') {
    return { kind: 'file', Icon: FilePdfOutlined, tone: 'pdf', label: 'PDF 文档' };
  }

  if (/\.(txt|md|log)$/.test(fileName) || fileType.startsWith('text/')) {
    return { kind: 'file', Icon: FileTextOutlined, tone: 'text', label: '文本文件' };
  }

  if (/\.zip$/.test(fileName) || /zip/.test(fileType)) {
    return { kind: 'file', Icon: FileZipOutlined, tone: 'zip', label: '压缩文件' };
  }

  return { kind: 'file', Icon: PaperClipOutlined, tone: 'default', label: '附件文件' };
}
