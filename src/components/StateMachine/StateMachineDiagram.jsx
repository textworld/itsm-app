import React, { useRef, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import ReactPlantUML from 'react-plantuml';

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

export default function StateMachineDiagram({ plantUmlSource }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  const updateZoom = (nextZoom) => {
    setZoom(clampZoom(nextZoom));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    updateZoom(zoom + direction * ZOOM_STEP);
  };

  const handleMouseDown = (event) => {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan
    };
  };

  const handleMouseMove = (event) => {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setPan({
      x: dragState.current.startPan.x + dx,
      y: dragState.current.startPan.y + dy
    });
  };

  const stopDragging = () => {
    dragState.current = null;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Space wrap>
        <Button size="small" onClick={() => updateZoom(zoom + ZOOM_STEP)}>
          放大
        </Button>
        <Button size="small" onClick={() => updateZoom(zoom - ZOOM_STEP)}>
          缩小
        </Button>
        <Button size="small" onClick={resetView}>
          重置
        </Button>
        <Typography.Text type="secondary">
          当前缩放：{Math.round(zoom * 100)}% · 鼠标滚轮缩放，拖动画布移动
        </Typography.Text>
      </Space>

      <div
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        style={{
          minHeight: 520,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: dragState.current ? 'grabbing' : 'grab',
          background: '#fff'
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            padding: 16,
            width: 'max-content'
          }}
        >
          <ReactPlantUML src={plantUmlSource} alt="工单状态机 PlantUML 图" />
        </div>
      </div>
    </Space>
  );
}

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}
