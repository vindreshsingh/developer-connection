import { getApiErrorMessage } from '@/commonUtils/apiError';

export const parsePlans = (data) => (data?.data || []).slice().sort((a, b) => a.price - b.price);

export const parseCurrentPlanKey = (subscriptionData) => subscriptionData?.data?.plan?.key ?? 'free';

export const parsePlansError = (error) => getApiErrorMessage(error, 'Could not load plans');
