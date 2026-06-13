import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { api } from '@/store/api';
import { useSocket } from '@/hooks/chat/useSocket';
import {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/hooks/notifications/notificationApi';
import { formatTime } from '@/commonUtils/formatDate';
import { classNames } from '@/commonUtils/classNames';
import './NotificationBell.scss';

const NOTIFICATION_TEXT = {
  post_like:    'liked your post',
  post_comment: 'commented on your post',
};

export default function NotificationBell() {
  const dispatch = useDispatch();
  const socket = useSocket();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const { data: unreadData } = useGetUnreadNotificationCountQuery();
  const { data, isFetching } = useGetNotificationsQuery({ page: 1 }, { skip: !open });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = data?.data ?? [];

  // Real-time: refresh the unread count (and list, if open) when the server
  // emits a new notification over the socket.
  useEffect(() => {
    if (!socket) return undefined;

    const onNotification = () => {
      dispatch(api.util.invalidateTags(['Notifications']));
    };

    socket.on('notification:new', onNotification);
    return () => socket.off('notification:new', onNotification);
  }, [socket, dispatch]);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (notification) => {
    if (!notification.read) markRead(notification._id);
  };

  return (
    <div className="dc-notification-bell" ref={containerRef}>
      <button
        type="button"
        className="dc-notification-bell-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && (
          <span className="dc-notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="dc-notification-bell-dropdown">
          <div className="dc-notification-bell-header">
            <span className="dc-notification-bell-title">Notifications</span>
            <button
              type="button"
              className="dc-notification-bell-mark-all"
              onClick={() => markAllRead()}
              disabled={isMarkingAll || unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          {isFetching ? (
            <p className="dc-notification-bell-loading">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="dc-notification-bell-empty">No notifications yet.</p>
          ) : (
            <ul className="dc-notification-bell-list">
              {notifications.map((notification) => {
                const actorName = [notification.actorId?.firstName, notification.actorId?.lastName]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <li
                    key={notification._id}
                    className={classNames(
                      'dc-notification-bell-item',
                      !notification.read && 'dc-notification-bell-item--unread',
                    )}
                  >
                    <Link
                      to="/posts"
                      className="dc-notification-bell-link"
                      onClick={() => {
                        handleNotificationClick(notification);
                        setOpen(false);
                      }}
                    >
                      <span className="dc-notification-bell-text">
                        <strong>{actorName || 'Someone'}</strong> {NOTIFICATION_TEXT[notification.type] ?? 'sent you a notification'}
                      </span>
                      <span className="dc-notification-bell-time">{formatTime(notification.createdAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
