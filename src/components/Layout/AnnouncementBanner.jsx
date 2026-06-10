'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Space, Tag, Typography } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../utils/format.js';

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

function getSnapshot(announcement) {
  return announcement?.activeSnapshot || announcement?.publishedSnapshot || {};
}

function getAnnouncementText(announcement) {
  const snapshot = getSnapshot(announcement);
  const systems = (snapshot.affectedSystems || []).map((item) => item.name).join('、') || '故障公告';
  const statusText = snapshot.progressText || snapshot.faultDescriptionText || '处置中';
  return `【${systems}】${snapshot.title || '故障公告'}：${statusText}，预计恢复 ${formatDateTime(snapshot.estimatedRecoveryAt)}`;
}

function isPinned(announcement) {
  return getSnapshot(announcement).display?.pinned === true;
}

function withClientDisplayDeadline(announcement) {
  if (isPinned(announcement)) return announcement;
  const seconds = Number(getSnapshot(announcement).display?.durationSeconds) || 0;
  return {
    ...announcement,
    clientDisplayUntil: seconds > 0 ? Date.now() + seconds * 1000 : null
  };
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { response, data } = await requestJson('/api/announcements/active');
        if (!active || !response.ok || data?.ok === false) return;
        setAnnouncements(
          Array.isArray(data?.announcements)
            ? data.announcements.map(withClientDisplayDeadline)
            : []
        );
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timers = announcements
      .filter((item) => !isPinned(item))
      .map((item) => {
        if (!item.clientDisplayUntil) return null;
        const delay = item.clientDisplayUntil - Date.now();
        if (delay <= 0) {
          setAnnouncements((current) => current.filter((announcement) => announcement.id !== item.id));
          return null;
        }
        return window.setTimeout(() => {
          setAnnouncements((current) => current.filter((announcement) => announcement.id !== item.id));
        }, delay);
      })
      .filter(Boolean);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [announcements]);

  const bannerText = useMemo(
    () => announcements.map(getAnnouncementText).join('     '),
    [announcements]
  );

  const scrollDuration = useMemo(() => {
    const slowestSpeed = announcements
      .map((item) => Number(getSnapshot(item).display?.scrollSpeed) || 40)
      .filter((speed) => speed > 0)
      .reduce((min, speed) => Math.min(min, speed), 40);
    return `${Math.max(10, Math.round(240 / Math.max(12, slowestSpeed) * 10))}s`;
  }, [announcements]);

  if (!announcements.length) return null;

  return (
    <div className="announcement-banner">
      <NotificationOutlined className="announcement-banner-icon" />
      <div className="announcement-banner-viewport">
        <div className="announcement-banner-track" style={{ animationDuration: scrollDuration }}>
          {bannerText}
        </div>
      </div>
      {announcements.some(isPinned) && <Tag className="announcement-banner-pin">置顶</Tag>}
      <Button type="link" size="small" onClick={() => setDetailOpen(true)}>
        查看详情
      </Button>
      <Drawer
        title="故障公告详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={680}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {announcements.map((announcement) => {
            const snapshot = getSnapshot(announcement);
            return (
              <div className="announcement-banner-detail" key={announcement.id}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space wrap>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {snapshot.title || '故障公告'}
                    </Typography.Title>
                    {isPinned(announcement) && <Tag color="gold">置顶</Tag>}
                  </Space>
                  <Typography.Text type="secondary">
                    预计恢复：{formatDateTime(snapshot.estimatedRecoveryAt)}
                  </Typography.Text>
                  <Alert
                    type="warning"
                    showIcon
                    message="故障描述"
                    description={(
                      <div
                        className="message-rich-content"
                        dangerouslySetInnerHTML={{ __html: snapshot.faultDescriptionHtml || '-' }}
                      />
                    )}
                  />
                  <Alert
                    type="info"
                    showIcon
                    message="当前处置进度"
                    description={(
                      <div
                        className="message-rich-content"
                        dangerouslySetInnerHTML={{ __html: snapshot.progressHtml || '-' }}
                      />
                    )}
                  />
                </Space>
              </div>
            );
          })}
        </Space>
      </Drawer>
    </div>
  );
}
