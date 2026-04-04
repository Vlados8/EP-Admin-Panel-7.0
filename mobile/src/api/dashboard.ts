import { apiClient } from './client';

export const fetchSummary = async () => {
    const { data } = await apiClient.get('/dashboard/summary');
    return data;
};

export const fetchRecentActivity = async () => {
    const { data } = await apiClient.get('/dashboard/recent-activity');
    return data;
};
