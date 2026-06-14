import ConnectionRequest from '../models/connectionRequest.js';
import { getRedis } from '../config/redis.js';

/**
 * Reusable connected-socket <-> userId presence registry.
 *
 * Deliberately chat-agnostic: Phase 5 (video calling) imports this same
 * service and calls `isOnline(userId)` for call-availability checks without
 * any chat-specific coupling.
 *
 * Multi-instance (Phase 10): when Redis is enabled the per-user socket count
 * is tracked in a Redis set (`presence:user:<id>`) so online/offline
 * transitions are computed across ALL ECS tasks — otherwise each task would
 * announce "offline" on its local last-disconnect even while the user is
 * still connected to another task. Presence broadcasts go to the recipient's
 * `user:<id>` room, which the Socket.IO Redis adapter fans out cross-task.
 * With no Redis it falls back to the original single-instance in-memory Map.
 */
class PresenceService {
  constructor(io) {
    this.io = io;
    // userId (string) -> Set<socket.id>. Local to this instance; still the
    // source of truth for the synchronous isOnline() in single-instance mode.
    this.userSockets = new Map();
  }

  _redisKey(userId) {
    return `presence:user:${userId}`;
  }

  isOnline(userId) {
    const sockets = this.userSockets.get(userId.toString());
    return Boolean(sockets && sockets.size > 0);
  }

  lastSeenAt() {
    // No persisted last-seen yet. Returning null keeps the contract explicit;
    // a future iteration could persist this in Redis on disconnect if
    // "last seen X ago" needs to survive across tasks/restarts.
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

    // Emit to each contact's personal room (joined on connect in
    // sockets/index.js). The Redis adapter delivers this to their sockets
    // regardless of which task they're connected to.
    connectionIds.forEach((connectionId) => {
      this.io.to(`user:${connectionId}`).emit('presence_update', payload);
    });
  }

  async registerConnection(socket) {
    const userId = socket.user._id.toString();

    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId).add(socket.id);

    // wasOffline is computed against the GLOBAL count when Redis is present,
    // so we only announce "online" on the user's first socket cluster-wide.
    const redis = getRedis();
    let wasOffline;
    if (redis) {
      const countBefore = await redis.scard(this._redisKey(userId));
      await redis.sadd(this._redisKey(userId), socket.id);
      wasOffline = countBefore === 0;
    } else {
      wasOffline = this.userSockets.get(userId).size === 1;
    }

    if (wasOffline) await this._broadcastPresence(userId, 'online');
  }

  async registerDisconnection(socket) {
    const userId = socket.user._id.toString();
    const sockets = this.userSockets.get(userId);
    const wasTracked = Boolean(sockets);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) this.userSockets.delete(userId);
    }

    // becameOffline is the GLOBAL last-disconnect when Redis is present, so we
    // don't announce "offline" while the user is still connected elsewhere.
    const redis = getRedis();
    let becameOffline;
    if (redis) {
      await redis.srem(this._redisKey(userId), socket.id);
      becameOffline = (await redis.scard(this._redisKey(userId))) === 0;
    } else {
      // Single-instance: only the last tracked socket flips a user offline.
      becameOffline = wasTracked && sockets.size === 0;
    }

    if (becameOffline) await this._broadcastPresence(userId, 'offline');
  }
}

export default PresenceService;
