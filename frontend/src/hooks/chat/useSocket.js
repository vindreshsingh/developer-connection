import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Low-level Socket.IO connection hook. Connects once per mount while the user
 * is authenticated (the handshake reuses the existing httpOnly JWT cookie via
 * `withCredentials` — no token handling on the client) and disconnects on
 * unmount.
 *
 * Scoped to the Messages container for this minimal slice; if Phase 4/5 need
 * presence available app-wide, lift this connection up into AuthProvider so
 * it's a true one-per-session singleton rather than one-per-mounted-page.
 */
export const useSocket = () => {
  const { user } = useCurrentUser();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;

    const instance = io(SOCKET_URL, { withCredentials: true, transports: ['websocket'] });
    socketRef.current = instance;
    // Synchronizing React state with an external system's connection object —
    // the documented exception (React docs: "Subscribing to an external store").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(instance);

    return () => {
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  return socket;
};
