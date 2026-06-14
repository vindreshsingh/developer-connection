import { api } from '@/store/api';

const postApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // GET /posts?scope=network|public&page=1
    getFeed: builder.query({
      query: ({ scope = 'network', page = 1 } = {}) => `/posts?scope=${scope}&page=${page}`,
      providesTags: (result) => [
        ...(result?.data ?? []).map((post) => ({ type: 'Posts', id: post._id })),
        { type: 'Posts', id: 'LIST' },
      ],
    }),

    // POST /posts
    createPost: builder.mutation({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),

    // POST /posts/upload-image
    uploadPostImage: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return { url: '/posts/upload-image', method: 'POST', body: formData };
      },
    }),

    // POST /posts/:postId/like
    likePost: builder.mutation({
      query: (postId) => ({ url: `/posts/${postId}/like`, method: 'POST' }),
      invalidatesTags: (result, error, postId) => [{ type: 'Posts', id: postId }],
    }),

    // DELETE /posts/:postId
    deletePost: builder.mutation({
      query: (postId) => ({ url: `/posts/${postId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),

    // GET /posts/:postId/comments?page=1
    getComments: builder.query({
      query: ({ postId, page = 1 }) => `/posts/${postId}/comments?page=${page}`,
      providesTags: (result, error, { postId }) => [{ type: 'PostComments', id: postId }],
    }),

    // POST /posts/:postId/comments
    addComment: builder.mutation({
      query: ({ postId, content }) => ({ url: `/posts/${postId}/comments`, method: 'POST', body: { content } }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId }, { type: 'Posts', id: postId },
      ],
    }),

    // DELETE /posts/:postId/comments/:commentId
    deleteComment: builder.mutation({
      query: ({ postId, commentId }) => ({ url: `/posts/${postId}/comments/${commentId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId }, { type: 'Posts', id: postId },
      ],
    }),
  }),
});

export const {
  useGetFeedQuery,
  useCreatePostMutation,
  useUploadPostImageMutation,
  useLikePostMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useAddCommentMutation,
  useDeleteCommentMutation,
} = postApi;
