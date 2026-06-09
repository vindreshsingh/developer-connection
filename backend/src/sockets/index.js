import { Server } from 'socket.io';
import socketAuthMiddleware from './authMiddleware.js';
import PresenceService from './presenceService.js';
import { registerChatHandlers } from './chatHandlers.js';
import { registerGroupChatHandlers } from './groupChatHandlers.js';
import { registerCallHandlers } from './callHandlers.js';
import { registerGroupCallHandlers } from './groupCallHandlers.js';

/**
 * Attaches Socket.IO to the existing Express HTTP server (no second server,
 * no second auth system — see RFC architecture). Returns the `io` instance
 * and the `presenceService` so chat handlers (and, later, Phase 5's video
 * signaling) can both consume them.
 */
export const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  const presenceService = new PresenceService(io);

  io.on('connection', (socket) => {
    // Join a personal room so REST routes can push per-user events (e.g.
    // call_incoming, call_rejected) via io.to(`user:<id>`).emit(...) without
    // needing to look up socket IDs in a separate registry.
    socket.join(`user:${socket.user._id}`);

    // Register event listeners SYNCHRONOUSLY, before any `await` — a client
    // may emit `join_conversation`/`send_message` immediately on connect, and
    // Socket.IO does not buffer events for listeners registered later. Doing
    // DB-touching presence registration first would create a race where the
    // first message from a fast client gets silently dropped.
    registerChatHandlers(io, socket);
    registerGroupChatHandlers(io, socket);
    registerCallHandlers(io, socket);
    registerGroupCallHandlers(io, socket);

    // Presence registration touches the DB — run it without blocking listener
    // setup. `_broadcastPresence` already swallows errors defensively.
    presenceService.registerConnection(socket).catch((err) => {
      socket.emit('chat_error', { event: 'presence', message: err.message });
    });

    socket.on('disconnect', async () => {
      await presenceService.registerDisconnection(socket);
    });
  });

  return { io, presenceService };
};

export default initSockets;
