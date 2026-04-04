import { apiClient } from './client';

export const fetchUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data.data.users;
};
