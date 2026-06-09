import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import User from '../models/user.js';

/**
 * Socket.IO handshake middleware that authenticates using the EXACT same
 * httpOnly JWT cookie (`token`) the existing `userAuth` REST middleware
 * validates — intentionally not a parallel auth system (per RFC: "no second
 * auth system").
 *
 * On success, attaches the authenticated Mongoose user document to
 * `socket.user` for downstream handlers (PresenceService, chatHandlers).
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers?.cookie;
    if (!rawCookie) return next(new Error('Authentication required'));

    const { token } = cookie.parse(rawCookie);
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('User not found'));

    if (decoded.tokenVersion !== user.tokenVersion) {
      return next(new Error('Session expired. Please login again'));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

export default socketAuthMiddleware;
