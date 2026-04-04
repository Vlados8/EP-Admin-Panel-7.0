import { apiClient } from './client';

export const fetchProjects = async () => {
  const { data } = await apiClient.get('/projects');
  return data;
};

export const fetchProjectById = async (id: number) => {
  const { data } = await apiClient.get(`/projects/${id}`);
  return data;
};

export const fetchProjectStages = async (projectId: number) => {
  const { data } = await apiClient.get(`/project-stages?projectId=${projectId}`);
  return data;
};

export const createProjectStage = async (formData: FormData) => {
  const { data } = await apiClient.post('/project-stages', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const updateProjectStage = async (id: number, formData: any) => {
  const isFormData = formData instanceof FormData;
  const { data } = await apiClient.patch(`/project-stages/${id}`, formData, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
  });
  return data;
};

export const deleteProjectStage = async (id: number) => {
  const { data } = await apiClient.delete(`/project-stages/${id}`);
  return data;
};

// Project Files
export const fetchProjectFiles = async (id: number, path: string = '') => {
  const { data } = await apiClient.get(`/projects/${id}/files?path=${encodeURIComponent(path)}`);
  return data;
};

export const uploadProjectFiles = async (id: number, formData: FormData) => {
  const { data } = await apiClient.post(`/projects/${id}/files/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const createProjectFolder = async (id: number, folderData: { name: string, path: string }) => {
  const { data } = await apiClient.post(`/projects/${id}/files/folder`, folderData);
  return data;
};

export const deleteProjectFile = async (id: number, filePath: string) => {
  const { data } = await apiClient.delete(`/projects/${id}/files?path=${encodeURIComponent(filePath)}`);
  return data;
};export const updateProject = async (id: number, payload: any) => {
  const { data } = await apiClient.patch(`/projects/${id}`, payload);
  return data;
};

export const fetchCategories = async () => {
  const { data } = await apiClient.get('/categories');
  return data;
};

export const fetchSubcontractors = async () => {
  const { data } = await apiClient.get('/subcontractors');
  return data;
};

export const updateProjectFolderPermissions = async (id: number, folderData: { path: string, name: string, allowed_role_ids: number[] | null }) => {
  const { data } = await apiClient.patch(`/projects/${id}/files/permissions`, folderData);
  return data;
};

export const toggleProjectFolderPublic = async (id: number, folderData: { path: string, name: string }) => {
  const { data } = await apiClient.post(`/projects/${id}/files/toggle-share`, folderData);
  return data;
};

