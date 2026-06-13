import { useState } from 'react';
import { useGetFeedQuery } from '@/hooks/posts/postApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { classNames } from '@/commonUtils/classNames';
import Button from '@/components/Button/Button';
import CreatePostBox from '@/widgets/CreatePostBox/CreatePostBox';
import PostCard from '@/widgets/PostCard/PostCard';
import './Posts.scss';

const SCOPES = [
  { value: 'network', label: 'My Network' },
  { value: 'public', label: 'Discover' },
];

export default function PostsContainer() {
  const [scope, setScope] = useState('network');
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useGetFeedQuery({ scope, page });

  const posts = data?.data ?? [];
  const pagination = data?.pagination;

  const handleScopeChange = (value) => {
    setScope(value);
    setPage(1);
  };

  return (
    <div className="dc-posts">
      <div className="dc-posts-header">
        <h1 className="dc-posts-title">Feed</h1>
        <div className="dc-posts-tabs">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={classNames('dc-posts-tab', scope === s.value && 'dc-posts-tab--active')}
              onClick={() => handleScopeChange(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <CreatePostBox />

      {error && (
        <p className="dc-posts-error">{getApiErrorMessage(error, 'Could not load feed')}</p>
      )}

      {isFetching ? (
        <p className="dc-posts-loading">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="dc-posts-empty">
          {scope === 'network'
            ? 'No posts yet from you or your connections. Be the first to share something!'
            : 'No posts yet. Be the first to share something!'}
        </p>
      ) : (
        <div className="dc-posts-list">
          {posts.map((post) => <PostCard key={post._id} post={post} />)}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="dc-posts-pagination">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </Button>
          <span className="dc-posts-pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
