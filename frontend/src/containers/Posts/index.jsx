import { useDispatch, useSelector } from 'react-redux';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useGetFeedQuery } from '@/hooks/posts/postApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { classNames } from '@/commonUtils/classNames';
import Button from '@/components/Button/Button';
import CreatePostBox from '@/widgets/CreatePostBox/CreatePostBox';
import PostCard from '@/widgets/PostCard/PostCard';
import reducer, { scopeChanged, pageChanged } from './reducer';

const SCOPES = [
  { value: 'network', label: 'My Network' },
  { value: 'public', label: 'Discover' },
];

export default function PostsContainer() {
  useInjectReducer('posts', reducer);

  const dispatch = useDispatch();
  const scope = useSelector((state) => state.posts?.scope ?? 'network');
  const page = useSelector((state) => state.posts?.page ?? 1);

  const { data, isFetching, error } = useGetFeedQuery({ scope, page });

  const posts = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto my-5 flex max-w-[640px] flex-col gap-4 px-3 sm:my-8 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">
        <h1 className="text-2xl font-bold text-gray-900">Feed</h1>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={classNames(
                'rounded-md px-3 py-1.5 text-[0.85rem] font-medium text-gray-500 transition-colors hover:text-gray-700',
                scope === s.value && 'bg-white text-violet-800 shadow-sm',
              )}
              onClick={() => dispatch(scopeChanged(s.value))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <CreatePostBox />

      {error && (
        <p className="text-red-600">{getApiErrorMessage(error, 'Could not load feed')}</p>
      )}

      {isFetching ? (
        <p className="py-12 text-center text-gray-500">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          {scope === 'network'
            ? 'No posts yet from you or your connections. Be the first to share something!'
            : 'No posts yet. Be the first to share something!'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => <PostCard key={post._id} post={post} />)}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => dispatch(pageChanged(Math.max(1, page - 1)))}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => dispatch(pageChanged(page + 1))}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
