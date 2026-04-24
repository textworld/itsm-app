import React, { useState } from 'react';
import { Image, Typography } from 'antd';

export default function RichContentPreview({
  html,
  text,
  className = '',
  emptyText = '-'
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const handleClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;

    setPreviewImage(target.currentSrc || target.src || '');
    setPreviewOpen(true);
  };

  if (html) {
    return (
      <>
        <div
          className={className}
          onClick={handleClick}
          dangerouslySetInnerHTML={{ __html: html }}
        />
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
    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
      {text || emptyText}
    </Typography.Paragraph>
  );
}
