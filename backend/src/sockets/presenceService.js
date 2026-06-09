import ConnectionRequest from '../models/connectionRequest.js';

/**
 * Reusable connected-socket <-> userId presence registry.
 *
 * Deliberately chat-agnostic: Phase 5 (video calling) can import this same
 * service and call `isOnline(userId)` for call-availability checks without
 * any chat-specific coupling. Single-instance only (in-memory) — see RFC for
 * why a Redis-backed registry is explicitly deferred.
 */
class PresenceService {
  constructor(io) {
    this.io = io;
    // userId (string) -> Set<socket.id>
    this.userSockets = new Map();
  }

  isOnline(userId) {
    const sockets = this.userSockets.get(userId.toString());
    return Boolean(sockets && sockets.size > 0);
  }

  lastSeenAt() {
    // Single-instance, in-memory: no persisted last-seen yet. Returning null
    // keeps the contract explicit; a future iteration could persist this on
    // disconnect if "last seen X ago" needs to survive a server restart.
    return null;
  }

  async _acceptedConnectionIds(userId) {
    const requests = await ConnectionRequest.find({
      status: 'accepted',
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).select('fromUserId toUserId');

    return requests.map((request) =>
      (request.fromUserId.equals(userId) ? request.toUserId : request.fromUserId).toString()
    );
  }

  async _broadcastPresence(userId, status) {
    let connectionIds;
    try {
      connectionIds = await this._acceptedConnectionIds(userId);
    } catch {
      // Best-effort: e.g. during server shutdown the DB connection may already
      // be closing when a final batch of sockets disconnect. Presence is a
      // "nice to have" signal — never let it crash the disconnect path.
      return;
    }
    const payload = { userId: userId.toString(), status, lastSeenAt: this.lastSeenAt() };

    connectionIds.forEach((connectionId) => {
      const sockets = this.userSockets.get(connectionId);
      if (!sockets) return;
      sockets.forEach((socketId) => this.io.to(socketId).emit('presence_update', payload));
    });
  }

  async registerConnection(socket) {
    const userId = socket.user._id.toString();
    const wasOffline = !this.isOnline(userId);

    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId).add(socket.id);

    if (wasOffline) await this._broadcastPresence(userId, 'online');
  }

  async registerDisconnection(socket) {
    const userId = socket.user._id.toString();
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      await this._broadcastPresence(userId, 'offline');
    }
  }
}

export default PresenceService;
