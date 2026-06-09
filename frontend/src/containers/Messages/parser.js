import { getApiErrorMessage } from '@/commonUtils/apiError';

export const parseConversations = (data) => data?.data || [];

export const parseConversationsError = (error) => getApiErrorMessage(error, '');
