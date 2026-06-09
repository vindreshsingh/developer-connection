import { useEffect, useState } from 'react';

/**
 * Subscribes to `presence_update` events from the socket and maintains a map
 * of userId → { status: 'online'|'offline', lastSeenAt: Date|null }.
 *
 * Only users who have emitted at least one presence_update are in the map;
 * unknown users are treated as offline by convention.
 *
 * @param {import('socket.io-client').Socket|null} socket
 * @returns {{ presenceMap: Map<string, { status: string, lastSeenAt: Date|null }>, isOnline: (userId: string) => boolean }}
 */
export const usePresence = (socket) => {
  const [presenceMap, setPresenceMap] = useState(new Map());

  useEffect(() => {
    if (!socket) return undefined;

    const onPresenceUpdate = ({ userId, status, lastSeenAt }) => {
      setPresenceMap((prev) => {
        const next = new Map(prev);
        next.set(userId, { status, lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : null });
        return next;
      });
    };

    socket.on('presence_update', onPresenceUpdate);
    return () => socket.off('presence_update', onPresenceUpdate);
  }, [socket]);

  const isOnline = (userId) => {
    const entry = presenceMap.get(userId?.toString());
    return entry?.status === 'online';
  };

  return { presenceMap, isOnline };
};
