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
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/profile?userId=${post.authorId._id}`} className="group flex min-w-0 items-center gap-3 text-inherit no-underline">
          <Avatar user={post.authorId} />
          <div>
            <p className="font-semibold text-gray-900 group-hover:underline">{authorName}</p>
            <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
          </div>
        </Link>
        {isAuthor && (
          <button
            type="button"
            className="flex-shrink-0 cursor-pointer border-none bg-transparent text-xs text-gray-400 hover:text-red-600"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            Delete
          </button>
        )}
      </div>

      {post.content && <p className="whitespace-pre-wrap break-words text-gray-800">{post.content}</p>}

      {post.codeSnippet?.code && (
        <SnippetBlock code={post.codeSnippet.code} language={post.codeSnippet.language} />
      )}

      {post.images?.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(8rem,1fr))]">
          {post.images.map((url) => (
            <ImagePreview key={url} src={url} alt="Post attachment" shape="banner" />
          ))}
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </div>
      )}

      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}

      <div className="flex items-center gap-4 border-t border-gray-100 pt-2">
        <button
          type="button"
          className={classNames(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.85rem] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700',
            post.likedByMe && 'text-red-600',
          )}
          onClick={handleLike}
        >
          {post.likedByMe ? '❤️' : '🤍'} {post.likeCount}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.85rem] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          onClick={() => setCommentsOpen((open) => !open)}
        >
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
    <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-2.5">
      {isLoading && <p className="text-[0.8rem] text-gray-400">Loading comments…</p>}

      {data?.data.map((comment) => {
        const canDelete = comment.authorId._id === currentUserId || postAuthorId === currentUserId;
        const commentAuthorName = [comment.authorId.firstName, comment.authorId.lastName].filter(Boolean).join(' ');

        return (
          <div key={comment._id} className="flex items-start gap-2">
            <Avatar user={comment.authorId} />
            <div className="min-w-0 flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5">
              <p className="text-[0.8rem] font-semibold text-gray-900">{commentAuthorName}</p>
              <p className="whitespace-pre-wrap break-words text-[0.85rem] text-gray-700">{comment.content}</p>
            </div>
            {canDelete && (
              <button
                type="button"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-base leading-none text-gray-400 hover:text-red-600"
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
        <div className="flex items-center justify-center gap-3 text-[0.8rem] text-gray-500">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!data.pagination.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      <form className="flex gap-2" onSubmit={handleAdd}>
        <FormInput
          placeholder="Write a comment…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          wrapperClassName="flex-1"
          maxLength={1000}
        />
        <Button type="submit" variant="outline" disabled={!content.trim() || isAdding}>
          Comment
        </Button>
      </form>

      {error && <p className="text-[0.8rem] text-red-600">{error}</p>}
    </div>
  );
}
