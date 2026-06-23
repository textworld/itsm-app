'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Button, Typography, App as AntdApp, Image } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  isAllowedAttachment,
  mapAttachmentsToUploadFileList,
  uploadAttachmentFile
} from '../../utils/fileUtils.js';

export default function FileUploader({
  fileList,
  onChange,
  multiple = true,
  maxCount = 10,
  disabled = false,
  variant = 'button',
  buttonText = '上传附件',
  acceptedTypes = ACCEPTED_ATTACHMENT_TYPES,
  validator = isAllowedAttachment,
  invalidTypeMessage = '不支持的附件类型'
}) {
  const { message } = AntdApp.useApp();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const fileListRef = useRef(fileList || []);

  useEffect(() => {
    fileListRef.current = fileList || [];
  }, [fileList]);

  const listType = useMemo(
    () => (variant === 'dragger' ? 'picture' : 'picture'),
    [variant]
  );

  const beforeUpload = async (file) => {
    if (!validator(file)) {
      message.error(`${invalidTypeMessage}：${file.name}`);
      return Upload.LIST_IGNORE;
    }

    if ((fileListRef.current?.length || 0) >= maxCount) {
      message.warning(`最多上传 ${maxCount} 个附件`);
      return Upload.LIST_IGNORE;
    }

    try {
      const attachment = await uploadAttachmentFile(file);
      const nextFileItem = mapAttachmentsToUploadFileList([attachment])[0];
      const nextFileList = [...(fileListRef.current || []), nextFileItem];
      fileListRef.current = nextFileList;
      onChange?.(nextFileList);
    } catch (error) {
      console.error(error);
      message.error(error.message || '附件上传失败');
    }

    return Upload.LIST_IGNORE;
  };

  const handlePreview = async (file) => {
    if (!isImageFile(file)) return;

    const previewSource = file.url || file.thumbUrl || file.preview || file.base64;
    if (!previewSource) return;

    setPreviewImage(previewSource);
    setPreviewOpen(true);
  };

  const handleRemove = (file) => {
    const nextFileList = (fileListRef.current || []).filter((item) => item.uid !== file.uid);
    fileListRef.current = nextFileList;
    onChange?.(nextFileList);
    return false;
  };

  const uploadProps = {
    accept: acceptedTypes,
    multiple,
    maxCount,
    beforeUpload,
    fileList,
    listType,
    onPreview: handlePreview,
    onRemove: handleRemove,
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
