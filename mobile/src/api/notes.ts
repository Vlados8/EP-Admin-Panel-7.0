import { apiClient } from './client';

export const fetchNotes = async () => {
    const { data } = await apiClient.get('/notes');
    return data;
};

export const fetchNotesByProjectId = async (projectId: number) => {
    const { data } = await apiClient.get(`/notes?projectId=${projectId}`);
    return data;
};

export const fetchNoteById = async (id: number) => {
    const { data } = await apiClient.get(`/notes/${id}`);
    return data;
};

export const createNote = async (formData: FormData) => {
  const response = await apiClient.post('/notes', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data.note;
};

export const updateNote = async (id: number, formData: FormData) => {
  const response = await apiClient.patch(`/notes/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data.note;
};

export const deleteNote = async (id: number) => {
  const response = await apiClient.delete(`/notes/${id}`);
  return response.data;
};
