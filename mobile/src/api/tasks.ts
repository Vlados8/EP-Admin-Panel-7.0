import { apiClient } from './client';

export const fetchTasks = async () => {
  const { data } = await apiClient.get('/tasks');
  return data;
};

export const fetchTaskById = async (id: number) => {
  const { data } = await apiClient.get(`/tasks/${id}`);
  return data;
};

export const updateTask = async (id: number, formData: FormData) => {
  const response = await apiClient.patch(`/tasks/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data.task;
};

export const fetchTasksByProjectId = async (projectId: number) => {
  const { data } = await apiClient.get(`/tasks?projectId=${projectId}`);
  return data;
};

export const updateTaskStatus = async (id: number, status: string) => {
  const response = await apiClient.patch(`/tasks/${id}`, { status });
  return response.data.data.task;
};

export const createTask = async (formData: FormData) => {
  const response = await apiClient.post('/tasks', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data.task;
};

export const fetchMyTasks = async () => {
  const { data } = await apiClient.get('/tasks/my-tasks');
  return data;
};

export const deleteTask = async (id: number) => {
  const response = await apiClient.delete(`/tasks/${id}`);
  return response.data;
};
