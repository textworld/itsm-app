import React, { useEffect, useRef } from 'react';
import { Button, Select, Space, Tooltip, App as AntdApp } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  UndoOutlined,
  RedoOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { fileToBase64 } from '../../utils/fileUtils.js';

const HEADING_OPTIONS = [
  { value: 'p', label: '正文' },
  { value: 'h2', label: '标题' },
  { value: 'blockquote', label: '引用' }
];

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = '请输入详细描述...'
}) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const { message } = AntdApp.useApp();

  useEffect(() => {
    if (!editorRef.current) return;
    const nextValue = value || '';
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range;
    }
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const emitChange = () => {
    onChange?.(editorRef.current?.innerHTML || '');
  };

  const executeCommand = (command, commandValue = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emitChange();
    saveSelection();
  };

  const handleCreateLink = () => {
    const url = window.prompt('请输入链接地址');
    if (!url) return;
    executeCommand('createLink', url);
  };

  const handleImageClick = () => {
    if (disabled) return;
    saveSelection();
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      message.error('只能在描述中插入图片文件');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${base64}" alt="${file.name}" style="max-width:100%;height:auto;" />`
      );
      emitChange();
    } catch (error) {
      console.error(error);
      message.error('图片插入失败，请重试');
    }
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
            <Button size="small" icon={<BoldOutlined />} onClick={() => executeCommand('bold')} />
          </Tooltip>
          <Tooltip title="斜体">
            <Button size="small" icon={<ItalicOutlined />} onClick={() => executeCommand('italic')} />
          </Tooltip>
          <Tooltip title="下划线">
            <Button size="small" icon={<UnderlineOutlined />} onClick={() => executeCommand('underline')} />
          </Tooltip>
          <Select
            size="small"
            defaultValue="p"
            style={{ width: 86 }}
            options={HEADING_OPTIONS}
            onChange={(tagName) => executeCommand('formatBlock', tagName)}
            disabled={disabled}
          />
          <Tooltip title="无序列表">
            <Button
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => executeCommand('insertUnorderedList')}
            />
          </Tooltip>
          <Tooltip title="有序列表">
            <Button
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => executeCommand('insertOrderedList')}
            />
          </Tooltip>
          <Tooltip title="链接">
            <Button size="small" icon={<LinkOutlined />} onClick={handleCreateLink} />
          </Tooltip>
          <Tooltip title="插入图片">
            <Button size="small" icon={<PictureOutlined />} onClick={handleImageClick} />
          </Tooltip>
          <Tooltip title="清除格式">
            <Button size="small" icon={<ClearOutlined />} onClick={() => executeCommand('removeFormat')} />
          </Tooltip>
        </Space>
      </div>
      <div
        ref={editorRef}
        className="rich-text-content"
        contentEditable={!disabled}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={saveSelection}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        suppressContentEditableWarning
      />
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
