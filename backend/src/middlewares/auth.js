import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const userAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Please login to continue' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });

    if (decoded.tokenVersion !== user.tokenVersion)
      return res.status(401).json({ error: 'Session expired. Please login again' });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default userAuth;
