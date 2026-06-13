/**
 * Tests for Phase 8 Tasks A2/A3/B2 — Posts REST API.
 *
 * Covers:
 *   - POST   /posts                       (validation, creation)
 *   - GET    /posts                       (network vs public feed, blocked-user exclusion)
 *   - GET    /posts/:postId               (404 for soft-deleted/missing)
 *   - DELETE /posts/:postId                (author-only soft-delete)
 *   - POST   /posts/:postId/like           (toggle, notification on like)
 *   - GET    /posts/:postId/comments       (pagination, oldest-first)
 *   - POST   /posts/:postId/comments       (creation, commentCount, notification)
 *   - DELETE /posts/:postId/comments/:id   (authorization matrix)
 *   - Socket emission for notification:new (Task B2)
 */

import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import Post from '../models/post.js';
import PostComment from '../models/postComment.js';
import Notification from '../models/notification.js';
import ConnectionRequest from '../models/connectionRequest.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    lastName: 'User',
    email: `${Math.random().toString(36).slice(2)}@example.com`,
    password: await hashPassword('password123'),
    isEmailVerified: true,
    ...overrides,
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

const connect = async (userAId, userBId) =>
  ConnectionRequest.create({ fromUserId: userAId, toUserId: userBId, status: 'accepted' });

const createPost = async (authorId, overrides = {}) =>
  Post.create({
    authorId,
    content: overrides.content ?? 'Hello world',
    ...overrides,
  });

// ── POST /posts ────────────────────────────────────────────────────────────────

describe('POST /posts', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/posts').send({ content: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when content, codeSnippet, and images are all empty', async () => {
    const { cookie } = await createUser();

    const res = await request(app).post('/posts').set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when more than 4 images are provided', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/posts')
      .set('Cookie', cookie)
      .send({ images: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'] });

    expect(res.status).toBe(400);
  });

  it('creates a post with text content and populates authorId', async () => {
    const { user, cookie } = await createUser();

    const res = await request(app)
      .post('/posts')
      .set('Cookie', cookie)
      .send({ content: 'My first post' });

    expect(res.status).toBe(201);
    expect(res.body.post.content).toBe('My first post');
    expect(res.body.post.authorId._id).toBe(user._id.toString());
    expect(res.body.post.authorId.firstName).toBe('Test');
    expect(res.body.post.likedByMe).toBe(false);
    expect(res.body.post.likes).toBeUndefined();
  });

  it('creates a post with only a code snippet', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/posts')
      .set('Cookie', cookie)
      .send({ codeSnippet: { code: 'console.log("hi")', language: 'javascript' } });

    expect(res.status).toBe(201);
    expect(res.body.post.codeSnippet.code).toBe('console.log("hi")');
    expect(res.body.post.codeSnippet.language).toBe('javascript');
  });

  it('creates a post with only images', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/posts')
      .set('Cookie', cookie)
      .send({ images: ['https://example.com/a.png'] });

    expect(res.status).toBe(201);
    expect(res.body.post.images).toEqual(['https://example.com/a.png']);
  });
});

// ── GET /posts ────────────────────────────────────────────────────────────────

describe('GET /posts', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/posts');
    expect(res.status).toBe(401);
  });

  it('network scope returns own posts and connections\' posts, not strangers\'', async () => {
    const { user, cookie } = await createUser();
    const { user: connection } = await createUser();
    const { user: stranger } = await createUser();

    await connect(user._id, connection._id);
    await createPost(user._id, { content: 'My post' });
    await createPost(connection._id, { content: 'Connection post' });
    await createPost(stranger._id, { content: 'Stranger post' });

    const res = await request(app).get('/posts?scope=network').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const contents = res.body.data.map((p) => p.content);
    expect(contents).toContain('My post');
    expect(contents).toContain('Connection post');
    expect(contents).not.toContain('Stranger post');
  });

  it('public scope returns posts from all non-blocked users', async () => {
    const { user, cookie } = await createUser();
    const { user: stranger } = await createUser();

    await createPost(user._id, { content: 'My post' });
    await createPost(stranger._id, { content: 'Stranger post' });

    const res = await request(app).get('/posts?scope=public').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const contents = res.body.data.map((p) => p.content);
    expect(contents).toContain('My post');
    expect(contents).toContain('Stranger post');
  });

  it('excludes posts from blocked users in public scope', async () => {
    const { user, cookie } = await createUser();
    const { user: blocked } = await createUser();

    await User.findByIdAndUpdate(user._id, { $push: { blockedUsers: blocked._id } });
    await createPost(blocked._id, { content: 'Blocked user post' });
    await createPost(user._id, { content: 'My post' });

    const res = await request(app).get('/posts?scope=public').set('Cookie', cookie);

    expect(res.status).toBe(200);
    const contents = res.body.data.map((p) => p.content);
    expect(contents).not.toContain('Blocked user post');
    expect(contents).toContain('My post');
  });

  it('does not return soft-deleted posts', async () => {
    const { user, cookie } = await createUser();
    await createPost(user._id, { content: 'Deleted post', deletedAt: new Date() });
    await createPost(user._id, { content: 'Visible post' });

    const res = await request(app).get('/posts?scope=public').set('Cookie', cookie);

    const contents = res.body.data.map((p) => p.content);
    expect(contents).not.toContain('Deleted post');
    expect(contents).toContain('Visible post');
  });
});

// ── GET /posts/:postId ────────────────────────────────────────────────────────

describe('GET /posts/:postId', () => {
  it('returns the post', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app).get(`/posts/${post._id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.post._id).toBe(post._id.toString());
  });

  it('returns 404 for a soft-deleted post', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id, { deletedAt: new Date() });

    const res = await request(app).get(`/posts/${post._id}`).set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a missing post', async () => {
    const { cookie } = await createUser();
    const res = await request(app).get('/posts/000000000000000000000000').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

// ── DELETE /posts/:postId ──────────────────────────────────────────────────────

describe('DELETE /posts/:postId', () => {
  it('allows the author to soft-delete their own post', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app).delete(`/posts/${post._id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const updated = await Post.findById(post._id);
    expect(updated.deletedAt).not.toBeNull();
  });

  it('returns 403 when a non-author tries to delete the post', async () => {
    const { user } = await createUser();
    const { cookie: otherCookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app).delete(`/posts/${post._id}`).set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  it('returns 404 when the post is already deleted', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id, { deletedAt: new Date() });

    const res = await request(app).delete(`/posts/${post._id}`).set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

// ── POST /posts/:postId/like ───────────────────────────────────────────────────

describe('POST /posts/:postId/like', () => {
  it('returns 404 for a missing or soft-deleted post', async () => {
    const { cookie } = await createUser();
    const res = await request(app).post('/posts/000000000000000000000000/like').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('toggles like, adjusts likeCount, and returns to original count when unliked', async () => {
    const { user: author } = await createUser();
    const { cookie } = await createUser();
    const post = await createPost(author._id);

    const likeRes = await request(app).post(`/posts/${post._id}/like`).set('Cookie', cookie);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body).toMatchObject({ liked: true, likeCount: 1 });

    const unlikeRes = await request(app).post(`/posts/${post._id}/like`).set('Cookie', cookie);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body).toMatchObject({ liked: false, likeCount: 0 });
  });

  it('creates a notification for the author when another user likes their post', async () => {
    const { user: author } = await createUser();
    const { cookie } = await createUser();
    const post = await createPost(author._id);

    await request(app).post(`/posts/${post._id}/like`).set('Cookie', cookie);

    const notifications = await Notification.find({ recipientId: author._id, type: 'post_like' });
    expect(notifications).toHaveLength(1);
  });

  it('does not create a notification when a user likes their own post', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    await request(app).post(`/posts/${post._id}/like`).set('Cookie', cookie);

    const notifications = await Notification.find({ recipientId: user._id, type: 'post_like' });
    expect(notifications).toHaveLength(0);
  });

  it('emits notification:new over the socket when a like creates a notification', async () => {
    const { user: author } = await createUser();
    const { cookie } = await createUser();
    const post = await createPost(author._id);

    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    app.set('io', { to });

    await request(app).post(`/posts/${post._id}/like`).set('Cookie', cookie);

    expect(to).toHaveBeenCalledWith(`user:${author._id}`);
    expect(emit).toHaveBeenCalledWith('notification:new', expect.anything());

    app.set('io', undefined);
  });
});

// ── GET /posts/:postId/comments ────────────────────────────────────────────────

describe('GET /posts/:postId/comments', () => {
  it('returns comments oldest-first with pagination', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const first  = await PostComment.create({ postId: post._id, authorId: user._id, content: 'First' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await PostComment.create({ postId: post._id, authorId: user._id, content: 'Second' });

    const res = await request(app).get(`/posts/${post._id}/comments`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c._id)).toEqual([first._id.toString(), second._id.toString()]);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('returns 404 for a missing post', async () => {
    const { cookie } = await createUser();
    const res = await request(app).get('/posts/000000000000000000000000/comments').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});

// ── POST /posts/:postId/comments ───────────────────────────────────────────────

describe('POST /posts/:postId/comments', () => {
  it('returns 400 for empty content', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app).post(`/posts/${post._id}/comments`).set('Cookie', cookie).send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for content over 1000 characters', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app)
      .post(`/posts/${post._id}/comments`)
      .set('Cookie', cookie)
      .send({ content: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('creates a comment and increments commentCount', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app)
      .post(`/posts/${post._id}/comments`)
      .set('Cookie', cookie)
      .send({ content: 'Nice post!' });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe('Nice post!');
    expect(res.body.comment.authorId.firstName).toBe('Test');

    const updated = await Post.findById(post._id);
    expect(updated.commentCount).toBe(1);
  });

  it('creates a notification for the author when another user comments', async () => {
    const { user: author } = await createUser();
    const { cookie } = await createUser();
    const post = await createPost(author._id);

    await request(app).post(`/posts/${post._id}/comments`).set('Cookie', cookie).send({ content: 'Nice!' });

    const notifications = await Notification.find({ recipientId: author._id, type: 'post_comment' });
    expect(notifications).toHaveLength(1);
  });

  it('does not create a notification when a user comments on their own post', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    await request(app).post(`/posts/${post._id}/comments`).set('Cookie', cookie).send({ content: 'Nice!' });

    const notifications = await Notification.find({ recipientId: user._id, type: 'post_comment' });
    expect(notifications).toHaveLength(0);
  });
});

// ── DELETE /posts/:postId/comments/:commentId ──────────────────────────────────

describe('DELETE /posts/:postId/comments/:commentId', () => {
  const setupComment = async () => {
    const { user: postAuthor, cookie: postAuthorCookie } = await createUser();
    const { user: commentAuthor, cookie: commentAuthorCookie } = await createUser();
    const { cookie: otherCookie } = await createUser();

    const post = await createPost(postAuthor._id);
    post.commentCount = 1;
    await post.save();

    const comment = await PostComment.create({
      postId: post._id,
      authorId: commentAuthor._id,
      content: 'A comment',
    });

    return { post, comment, postAuthorCookie, commentAuthorCookie, otherCookie };
  };

  it('allows the comment author to delete their comment and decrements commentCount', async () => {
    const { post, comment, commentAuthorCookie } = await setupComment();

    const res = await request(app)
      .delete(`/posts/${post._id}/comments/${comment._id}`)
      .set('Cookie', commentAuthorCookie);

    expect(res.status).toBe(200);

    const updatedPost = await Post.findById(post._id);
    expect(updatedPost.commentCount).toBe(0);

    const updatedComment = await PostComment.findById(comment._id);
    expect(updatedComment.deletedAt).not.toBeNull();
  });

  it('allows the post author to delete someone else\'s comment', async () => {
    const { post, comment, postAuthorCookie } = await setupComment();

    const res = await request(app)
      .delete(`/posts/${post._id}/comments/${comment._id}`)
      .set('Cookie', postAuthorCookie);

    expect(res.status).toBe(200);
  });

  it('returns 403 for a user who is neither the comment author nor the post author', async () => {
    const { post, comment, otherCookie } = await setupComment();

    const res = await request(app)
      .delete(`/posts/${post._id}/comments/${comment._id}`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a missing comment', async () => {
    const { user, cookie } = await createUser();
    const post = await createPost(user._id);

    const res = await request(app)
      .delete(`/posts/${post._id}/comments/000000000000000000000000`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});
