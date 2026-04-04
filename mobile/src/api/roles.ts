import { apiClient } from './client';

export const fetchRoles = async () => {
    const { data } = await apiClient.get('/roles');
    return data;
};
