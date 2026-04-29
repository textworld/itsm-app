'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Button, Select, Slider, Space, Tooltip, App as AntdApp } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  RedoOutlined,
  ClearOutlined
} from '@ant-design/icons';
import Placeholder from '@tiptap/extension-placeholder';

import {
  createEmptyRichTextDoc,
  isRichTextDocument,
  RICH_TEXT_EXTENSIONS,
  richTextHtmlToDoc
} from '../../utils/richText.js';
import { uploadAttachmentFile } from '../../utils/fileUtils.js';

const HEADING_OPTIONS = [
  { value: 'p', label: '正文' },
  { value: 'h2', label: '标题' },
  { value: 'blockquote', label: '引用' }
];

const IMAGE_WIDTH_MIN = 20;
const IMAGE_WIDTH_MAX = 100;
const IMAGE_WIDTH_STEP = 5;

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = '请输入详细描述...'
}) {
  const { message } = AntdApp.useApp();
  const fileInputRef = useRef(null);
  const lastSerializedValueRef = useRef(null);

  const extensions = useMemo(
    () => [
      ...RICH_TEXT_EXTENSIONS,
      Placeholder.configure({
        placeholder
      })
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: normalizeEditorValue(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-text-content'
      },
      handlePaste: (_view, event) => {
        const file = getPastedImageFile(event);
        if (!file) {
          return false;
        }

        event.preventDefault();
        void uploadAndInsertImage(file);
        return true;
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextJson = currentEditor.getJSON();
      lastSerializedValueRef.current = JSON.stringify(nextJson);
      onChange?.(nextJson);
    }
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;

    const nextContent = normalizeEditorValue(value);
    const serialized = JSON.stringify(nextContent);
    if (serialized === lastSerializedValueRef.current) {
      return;
    }

    editor.commands.setContent(nextContent, false);
    lastSerializedValueRef.current = serialized;
  }, [editor, value]);

  const uploadAndInsertImage = async (file) => {
    if (!editor || disabled) return;
    if (!file.type.startsWith('image/')) {
      message.error('只能在描述中插入图片文件');
      return;
    }

    try {
      const uploaded = await uploadAttachmentFile(file);
      editor
        .chain()
        .focus()
        .setImage({
          src: uploaded.url,
          alt: file.name,
          title: file.name,
          uploadId: uploaded.uploadId,
          widthPercent: 100
        })
        .run();
    } catch (error) {
      console.error(error);
      message.error(error.message || '图片上传失败，请重试');
    }
  };

  const executeCommand = (command, commandValue = null) => {
    if (!editor || disabled) return;

    switch (command) {
      case 'undo':
        editor.chain().focus().undo().run();
        break;
      case 'redo':
        editor.chain().focus().redo().run();
        break;
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'insertUnorderedList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'insertOrderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'removeFormat':
        editor.chain().focus().unsetAllMarks().clearNodes().run();
        break;
      case 'formatBlock':
        applyBlockType(editor, commandValue);
        break;
      default:
        break;
    }
  };

  const handleCreateLink = () => {
    if (!editor || disabled) return;
    const currentHref = editor.getAttributes('link').href || '';
    const url = window.prompt('请输入链接地址', currentHref);
    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url.trim() })
      .run();
  };

  const handleImageClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadAndInsertImage(file);
  };

  const currentBlockValue = getCurrentBlockValue(editor);
  const isImageActive = Boolean(editor?.isActive('image'));
  const imageWidthPercent = getCurrentImageWidthPercent(editor);
  const setImageWidthPercent = (value) => {
    if (!editor || disabled || !isImageActive) return;
    editor
      .chain()
      .focus()
      .updateAttributes('image', { widthPercent: clampImageWidthPercent(value) })
      .run();
  };
  const adjustImageWidthPercent = (delta) => {
    setImageWidthPercent(imageWidthPercent + delta);
  };

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" onMouseDown={(event) => event.preventDefault()}>
        <Space size={4} wrap>
          <Tooltip title="撤销">
            <Button size="small" icon={<UndoOutlined />} onClick={() => executeCommand('undo')} />
          </Tooltip>
          <Tooltip title="重做">
            <Button size="small" icon={<RedoOutlined />} onClick={() => executeCommand('redo')} />
          </Tooltip>
          <Tooltip title="加粗">
            <Button
              size="small"
              type={editor?.isActive('bold') ? 'primary' : 'default'}
              icon={<BoldOutlined />}
              onClick={() => executeCommand('bold')}
            />
          </Tooltip>
          <Tooltip title="斜体">
            <Button
              size="small"
              type={editor?.isActive('italic') ? 'primary' : 'default'}
              icon={<ItalicOutlined />}
              onClick={() => executeCommand('italic')}
            />
          </Tooltip>
          <Tooltip title="下划线">
            <Button
              size="small"
              type={editor?.isActive('underline') ? 'primary' : 'default'}
              icon={<UnderlineOutlined />}
              onClick={() => executeCommand('underline')}
            />
          </Tooltip>
          <Select
            size="small"
            value={currentBlockValue}
            style={{ width: 86 }}
            options={HEADING_OPTIONS}
            onChange={(tagName) => executeCommand('formatBlock', tagName)}
            disabled={disabled}
          />
          <Tooltip title="无序列表">
            <Button
              size="small"
              type={editor?.isActive('bulletList') ? 'primary' : 'default'}
              icon={<UnorderedListOutlined />}
              onClick={() => executeCommand('insertUnorderedList')}
            />
          </Tooltip>
          <Tooltip title="有序列表">
            <Button
              size="small"
              type={editor?.isActive('orderedList') ? 'primary' : 'default'}
              icon={<OrderedListOutlined />}
              onClick={() => executeCommand('insertOrderedList')}
            />
          </Tooltip>
          <Tooltip title="链接">
            <Button
              size="small"
              type={editor?.isActive('link') ? 'primary' : 'default'}
              icon={<LinkOutlined />}
              onClick={handleCreateLink}
            />
          </Tooltip>
          <Tooltip title="插入图片">
            <Button size="small" icon={<PictureOutlined />} onClick={handleImageClick} />
          </Tooltip>
          <Tooltip title="缩小图片">
            <Button
              size="small"
              icon={<ZoomOutOutlined />}
              disabled={!isImageActive || disabled || imageWidthPercent <= IMAGE_WIDTH_MIN}
              onClick={() => adjustImageWidthPercent(-IMAGE_WIDTH_STEP)}
            />
          </Tooltip>
          <span className="rich-text-image-scale-control" onMouseDown={(event) => event.stopPropagation()}>
            <Slider
              min={IMAGE_WIDTH_MIN}
              max={IMAGE_WIDTH_MAX}
              step={IMAGE_WIDTH_STEP}
              value={imageWidthPercent}
              onChange={setImageWidthPercent}
              disabled={!isImageActive || disabled}
              tooltip={{ formatter: (value) => `${value}%` }}
            />
          </span>
          <Tooltip title="放大图片">
            <Button
              size="small"
              icon={<ZoomInOutlined />}
              disabled={!isImageActive || disabled || imageWidthPercent >= IMAGE_WIDTH_MAX}
              onClick={() => adjustImageWidthPercent(IMAGE_WIDTH_STEP)}
            />
          </Tooltip>
          <Tooltip title="清除格式">
            <Button size="small" icon={<ClearOutlined />} onClick={() => executeCommand('removeFormat')} />
          </Tooltip>
        </Space>
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />
    </div>
  );
}

function normalizeEditorValue(value) {
  if (isRichTextDocument(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return richTextHtmlToDoc(value);
  }

  return createEmptyRichTextDoc();
}

function applyBlockType(editor, tagName) {
  if (!editor) return;

  if (tagName === 'h2') {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    return;
  }

  if (tagName === 'blockquote') {
    editor.chain().focus().toggleBlockquote().run();
    return;
  }

  editor.chain().focus().setParagraph().run();
}

function getCurrentBlockValue(editor) {
  if (!editor) return 'p';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('blockquote')) return 'blockquote';
  return 'p';
}

function getCurrentImageWidthPercent(editor) {
  if (!editor?.isActive('image')) return IMAGE_WIDTH_MAX;
  return clampImageWidthPercent(editor.getAttributes('image').widthPercent || IMAGE_WIDTH_MAX);
}

function clampImageWidthPercent(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return IMAGE_WIDTH_MAX;
  return Math.min(IMAGE_WIDTH_MAX, Math.max(IMAGE_WIDTH_MIN, parsed));
}

function getPastedImageFile(event) {
  const items = Array.from(event?.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type?.startsWith('image/'));
  return imageItem?.getAsFile() || null;
}
