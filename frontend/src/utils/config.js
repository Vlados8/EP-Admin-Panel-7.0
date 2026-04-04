/**
 * Application configuration
 */
export const API_BASE_URL = import.meta.env.PROD 
  ? '' // In production, we use relative paths as the backend serves the frontend
  : 'http://localhost:3000'; // In development, the backend is running locally on port 3000

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};
