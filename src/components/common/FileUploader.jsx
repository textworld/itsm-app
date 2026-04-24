import React, { useMemo, useState } from 'react';
import { Upload, Button, Typography, App as AntdApp, Image } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  isAllowedAttachment,
  fileToBase64
} from '../../utils/fileUtils.js';

export default function FileUploader({
  fileList,
  onChange,
  multiple = true,
  maxCount = 10,
  disabled = false,
  variant = 'button',
  buttonText = '上传附件'
}) {
  const { message } = AntdApp.useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const listType = useMemo(
    () => (variant === 'dragger' ? 'picture' : 'picture'),
    [variant]
  );

  const beforeUpload = (file) => {
    if (!isAllowedAttachment(file)) {
      message.error(`不支持的附件类型：${file.name}`);
      return Upload.LIST_IGNORE;
    }

    return false;
  };

  const handlePreview = async (file) => {
    if (!isImageFile(file)) return;

    let previewSource = file.url || file.thumbUrl || file.preview;

    if (!previewSource && file.originFileObj) {
      previewSource = await fileToBase64(file.originFileObj);
      file.preview = previewSource;
    }

    if (!previewSource && file.base64) {
      previewSource = file.base64;
    }

    if (!previewSource) return;

    setPreviewImage(previewSource);
    setPreviewOpen(true);
  };

  const uploadProps = {
    accept: ACCEPTED_ATTACHMENT_TYPES,
    multiple,
    maxCount,
    beforeUpload,
    fileList,
    listType,
    onPreview: handlePreview,
    onChange: ({ fileList: next }) => onChange && onChange(next),
    disabled
  };

  if (variant === 'dragger') {
    return (
      <>
        <Upload.Dragger {...uploadProps} className="reference-upload">
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <Typography.Text>点击或拖拽文件到此处上传</Typography.Text>
          <br />
          <Typography.Text type="secondary">
            支持图片、Word、Excel、PDF、PPT、TXT、CSV、ZIP，最多 {maxCount} 个
          </Typography.Text>
        </Upload.Dragger>
        <Image
          wrapperStyle={{ display: 'none' }}
          preview={{
            visible: previewOpen,
            src: previewImage,
            onVisibleChange: (visible) => setPreviewOpen(visible)
          }}
        />
      </>
    );
  }

  return (
    <>
      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />} disabled={disabled}>
          {buttonText}
        </Button>
      </Upload>
      <Image
        wrapperStyle={{ display: 'none' }}
        preview={{
          visible: previewOpen,
          src: previewImage,
          onVisibleChange: (visible) => setPreviewOpen(visible)
        }}
      />
    </>
  );
}

function isImageFile(file) {
  const fileType = (file?.type || file?.originFileObj?.type || '').toLowerCase();
  const fileName = (file?.name || '').toLowerCase();

  return fileType.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(fileName);
}
