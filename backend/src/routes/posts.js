/**
 * Posts REST API — mounted at /posts in app.js.
 *
 * Authorization matrix (from RFC):
 *   POST   /                       logged in — create a post
 *   POST   /upload-image           logged in — upload an image, returns { url }
 *   GET    /                       logged in — paginated feed (?scope=network|public)
 *   GET    /:postId                logged in — single post detail
 *   DELETE /:postId                author only — soft-delete
 *   POST   /:postId/like           logged in — toggle like
 *   GET    /:postId/comments       logged in — paginated comments
 *   POST   /:postId/comments       logged in — add a comment
 *   DELETE /:postId/comments/:id   comment author or post author
 */

import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import userAuth from '../middlewares/auth.js';
import { POSTS } from '../constants/apiEndpoints.js';
import { uploadImageBuffer } from '../utils/cloudinary.js';
import Post from '../models/post.js';
import PostComment from '../models/postComment.js';
import Notification from '../models/notification.js';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';

const router = express.Router();

const PAGE_SIZE         = 10;
const COMMENT_PAGE_SIZE = 20;
const MAX_IMAGES        = 4;
const MAX_IMAGE_SIZE    = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Returns the ObjectIds of users with an accepted connection to `userId`. */
const getConnectionIds = async (userId) => {
  const connections = await ConnectionRequest.find({
    $or: [
      { fromUserId: userId, status: 'accepted' },
      { toUserId: userId, status: 'accepted' },
    ],
  }).select('fromUserId toUserId');
  return connections.map((c) => (c.fromUserId.equals(userId) ? c.toUserId : c.fromUserId));
};

/** Returns the ObjectIds to exclude from `user`'s feed: users they blocked + users who blocked them. */
const getExcludedUserIds = async (user) => {
  const blockedMe = await User.find({ blockedUsers: user._id }).select('_id');
  return [...user.blockedUsers, ...blockedMe.map((u) => u._id)];
};

/** Serializes a Post document for API responses: strips raw `likes[]`, adds `likedByMe`. */
const formatPost = (postDoc, userId) => {
  const likedByMe = postDoc.isLikedBy(userId);
  const obj = postDoc.toObject();
  delete obj.likes;
  obj.likedByMe = likedByMe;
  return obj;
};

/** Emits `notification:new` to the recipient's socket room, if Socket.io is attached. */
const emitNotification = async (req, notification) => {
  const io = req.app.get('io');
  if (!io) return;

  const populated = await Notification.findById(notification._id)
    .populate('actorId', 'firstName lastName photoUrl');
  io.to(`user:${notification.recipientId}`).emit('notification:new', populated);
};

// ── POST / — Create a post ────────────────────────────────────────────────────

router.post(POSTS.CREATE, userAuth, async (req, res) => {
  try {
    const { content, codeSnippet, images } = req.body;

    const trimmedContent = content?.trim() ?? '';
    const code = codeSnippet?.code?.trim();
    const postImages = Array.isArray(images) ? images : [];

    if (!trimmedContent && !code && postImages.length === 0)
      return res.status(400).json({ error: 'Post must include text, a code snippet, or at least one image.' });

    if (postImages.length > MAX_IMAGES)
      return res.status(400).json({ error: `A post can include at most ${MAX_IMAGES} images.` });

    const post = await Post.create({
      authorId: req.user._id,
      content:  trimmedContent,
      codeSnippet: code
        ? { code, language: codeSnippet?.language?.trim() || null }
        : undefined,
      images: postImages,
    });

    await post.populate('authorId', 'firstName lastName photoUrl');

    res.status(201).json({ message: 'Post created.', post: formatPost(post, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /upload-image — Upload an image for a post ──────────────────────────

router.post(
  POSTS.UPLOAD_IMAGE,
  userAuth,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided' });

      const result = await uploadImageBuffer(req.file.buffer, 'posts');
      res.status(200).json({ url: result.secure_url });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

// ── GET / — Paginated feed ─────────────────────────────────────────────────────

router.get(POSTS.LIST, userAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const scope = req.query.scope === 'public' ? 'public' : 'network';

    const excludedIds = await getExcludedUserIds(req.user);

    const filter = { deletedAt: null };
    if (scope === 'network') {
      const connectionIds = await getConnectionIds(req.user._id);
      const allowedIds = [req.user._id, ...connectionIds].filter(
        (id) => !excludedIds.some((excluded) => excluded.equals(id)),
      );
      filter.authorId = { $in: allowedIds };
    } else {
      filter.authorId = { $nin: excludedIds };
    }

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('authorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: posts.map((post) => formatPost(post, req.user._id)),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:postId — Single post detail ─────────────────────────────────────────

router.get(POSTS.GET, userAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null })
      .populate('authorId', 'firstName lastName photoUrl');
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.status(200).json({ post: formatPost(post, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:postId — Author-only soft-delete ─────────────────────────────────

router.delete(POSTS.DELETE, userAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (!post.authorId.equals(req.user._id))
      return res.status(403).json({ error: 'You can only delete your own posts.' });

    post.deletedAt = new Date();
    await post.save();

    res.status(200).json({ message: 'Post deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:postId/like — Toggle like ──────────────────────────────────────────

router.post(POSTS.LIKE, userAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const alreadyLiked = post.isLikedBy(req.user._id);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => !id.equals(req.user._id));
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      post.likes.push(req.user._id);
      post.likeCount += 1;
    }

    await post.save();

    if (!alreadyLiked && !post.authorId.equals(req.user._id)) {
      const notification = await Notification.create({
        recipientId: post.authorId,
        actorId:     req.user._id,
        type:        'post_like',
        postId:      post._id,
      });
      await emitNotification(req, notification);
    }

    res.status(200).json({ liked: !alreadyLiked, likeCount: post.likeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:postId/comments — Paginated comments, oldest-first ─────────────────

router.get(POSTS.COMMENTS, userAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { postId, deletedAt: null };

    const total = await PostComment.countDocuments(filter);
    const comments = await PostComment.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * COMMENT_PAGE_SIZE)
      .limit(COMMENT_PAGE_SIZE)
      .populate('authorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: comments,
      pagination: {
        page,
        pageSize: COMMENT_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / COMMENT_PAGE_SIZE),
        hasNextPage: page * COMMENT_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:postId/comments — Add a comment ───────────────────────────────────

router.post(POSTS.COMMENTS, userAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!validObjectId(postId)) return res.status(404).json({ error: 'Post not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const content = req.body.content?.trim();
    if (!content) return res.status(400).json({ error: 'Comment content is required.' });
    if (content.length > 1000) return res.status(400).json({ error: 'Comment cannot exceed 1000 characters.' });

    const comment = await PostComment.create({
      postId:   post._id,
      authorId: req.user._id,
      content,
    });

    post.commentCount += 1;
    await post.save();

    await comment.populate('authorId', 'firstName lastName photoUrl');

    if (!post.authorId.equals(req.user._id)) {
      const notification = await Notification.create({
        recipientId: post.authorId,
        actorId:     req.user._id,
        type:        'post_comment',
        postId:      post._id,
      });
      await emitNotification(req, notification);
    }

    res.status(201).json({ message: 'Comment added.', comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:postId/comments/:commentId ───────────────────────────────────────

router.delete(POSTS.DELETE_COMMENT, userAuth, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    if (!validObjectId(postId) || !validObjectId(commentId))
      return res.status(404).json({ error: 'Comment not found.' });

    const post = await Post.findOne({ _id: postId, deletedAt: null });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = await PostComment.findOne({ _id: commentId, postId, deletedAt: null });
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const isCommentAuthor = comment.authorId.equals(req.user._id);
    const isPostAuthor    = post.authorId.equals(req.user._id);
    if (!isCommentAuthor && !isPostAuthor)
      return res.status(403).json({ error: 'You cannot delete this comment.' });

    comment.deletedAt = new Date();
    await comment.save();

    post.commentCount = Math.max(0, post.commentCount - 1);
    await post.save();

    res.status(200).json({ message: 'Comment deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
