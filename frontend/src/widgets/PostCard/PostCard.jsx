import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import Tag from '@/components/Tag/Tag';
import FormInput from '@/components/FormInput/FormInput';
import ImagePreview from '@/components/ImagePreview/ImagePreview';
import SnippetBlock from '@/widgets/SnippetBlock/SnippetBlock';
import {
  useLikePostMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
} from '@/hooks/posts/postApi';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { classNames } from '@/commonUtils/classNames';
import './PostCard.scss';

export default function PostCard({ post }) {
  const { user } = useCurrentUser();
  const [likePost] = useLikePostMutation();
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [error, setError] = useState('');

  const isAuthor = post.authorId._id === user?._id;
  const authorName = [post.authorId.firstName, post.authorId.lastName].filter(Boolean).join(' ');

  const handleLike = async () => {
    setError('');
    try {
      await likePost(post._id).unwrap();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update like'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    setError('');
    try {
      await deletePost(post._id).unwrap();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete post'));
    }
  };

  return (
    <div className="dc-post-card">
      <div className="dc-post-card-header">
        <Link to={`/profile?userId=${post.authorId._id}`} className="dc-post-card-author">
          <Avatar user={post.authorId} />
          <div>
            <p className="dc-post-card-author-name">{authorName}</p>
            <p className="dc-post-card-time">{new Date(post.createdAt).toLocaleString()}</p>
          </div>
        </Link>
        {isAuthor && (
          <button type="button" className="dc-post-card-delete" onClick={handleDelete} disabled={isDeleting}>
            Delete
          </button>
        )}
      </div>

      {post.content && <p className="dc-post-card-content">{post.content}</p>}

      {post.codeSnippet?.code && (
        <SnippetBlock code={post.codeSnippet.code} language={post.codeSnippet.language} />
      )}

      {post.images?.length > 0 && (
        <div className="dc-post-card-images">
          {post.images.map((url) => (
            <ImagePreview key={url} src={url} alt="Post attachment" shape="banner" />
          ))}
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="dc-post-card-tags">
          {post.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
      )}

      {error && <p className="dc-post-card-error">{error}</p>}

      <div className="dc-post-card-actions">
        <button
          type="button"
          className={classNames('dc-post-card-like-btn', post.likedByMe && 'dc-post-card-like-btn--active')}
          onClick={handleLike}
        >
          {post.likedByMe ? '❤️' : '🤍'} {post.likeCount}
        </button>
        <button type="button" className="dc-post-card-comment-btn" onClick={() => setCommentsOpen((open) => !open)}>
          💬 {post.commentCount}
        </button>
      </div>

      {commentsOpen && (
        <PostComments postId={post._id} postAuthorId={post.authorId._id} currentUserId={user?._id} />
      )}
    </div>
  );
}

function PostComments({ postId, postAuthorId, currentUserId }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetCommentsQuery({ postId, page });
  const [addComment, { isLoading: isAdding }] = useAddCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isAdding) return;

    setError('');
    try {
      await addComment({ postId, content: trimmed }).unwrap();
      setContent('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add comment'));
    }
  };

  const handleDelete = async (commentId) => {
    setError('');
    try {
      await deleteComment({ postId, commentId }).unwrap();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete comment'));
    }
  };

  return (
    <div className="dc-post-card-comments">
      {isLoading && <p className="dc-post-card-comments-loading">Loading comments…</p>}

      {data?.data.map((comment) => {
        const canDelete = comment.authorId._id === currentUserId || postAuthorId === currentUserId;
        const commentAuthorName = [comment.authorId.firstName, comment.authorId.lastName].filter(Boolean).join(' ');

        return (
          <div key={comment._id} className="dc-post-card-comment">
            <Avatar user={comment.authorId} />
            <div className="dc-post-card-comment-body">
              <p className="dc-post-card-comment-author">{commentAuthorName}</p>
              <p className="dc-post-card-comment-content">{comment.content}</p>
            </div>
            {canDelete && (
              <button
                type="button"
                className="dc-post-card-comment-delete"
                onClick={() => handleDelete(comment._id)}
                aria-label="Delete comment"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="dc-post-card-comments-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
          <button type="button" disabled={!data.pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      <form className="dc-post-card-comment-form" onSubmit={handleAdd}>
        <FormInput
          placeholder="Write a comment…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          wrapperClassName="dc-post-card-comment-input"
          maxLength={1000}
        />
        <Button type="submit" variant="outline" disabled={!content.trim() || isAdding}>
          Comment
        </Button>
      </form>

      {error && <p className="dc-post-card-error">{error}</p>}
    </div>
  );
}
