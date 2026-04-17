/**
 * Application configuration
 */
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
};

export const API_BASE_URL = import.meta.env.PROD 
  ? '' // In production, we use relative paths as the backend serves the frontend
  : getApiUrl().replace('/api/v1', ''); // Point to server root

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Ensure we don't have double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};
