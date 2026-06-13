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
    <div className="relative ml-2" ref={containerRef}>
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-none bg-none text-[1.1rem] transition-colors hover:bg-gray-100"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute right-[0.1rem] top-[0.1rem] flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[0.65rem] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 max-h-96 w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.25)] sm:w-80">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <span className="font-semibold text-gray-900">Notifications</span>
            <button
              type="button"
              className="border-none bg-none text-xs text-violet-700 disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline hover:underline"
              onClick={() => markAllRead()}
              disabled={isMarkingAll || unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          {isFetching ? (
            <p className="px-4 py-6 text-center text-[0.85rem] text-gray-400">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-[0.85rem] text-gray-400">No notifications yet.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {notifications.map((notification) => {
                const actorName = [notification.actorId?.firstName, notification.actorId?.lastName]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <li
                    key={notification._id}
                    className={classNames(
                      'border-b border-gray-50 last:border-b-0',
                      !notification.read && 'bg-violet-50',
                    )}
                  >
                    <Link
                      to="/posts"
                      className="flex flex-col gap-0.5 px-4 py-2.5 text-inherit no-underline hover:bg-gray-100"
                      onClick={() => {
                        handleNotificationClick(notification);
                        setOpen(false);
                      }}
                    >
                      <span className="text-[0.85rem] text-gray-700">
                        <strong>{actorName || 'Someone'}</strong> {NOTIFICATION_TEXT[notification.type] ?? 'sent you a notification'}
                      </span>
                      <span className="text-[0.7rem] text-gray-400">{formatTime(notification.createdAt)}</span>
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
