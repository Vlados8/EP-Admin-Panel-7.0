import axios from 'axios';

const baseURL = import.meta.env.PROD
    ? '/api/v1'
    : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1');

const api = axios.create({
    baseURL
});

// Request Interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use((response) => {
    return response;
}, (error) => {
    const originalRequest = error.config;
    
    // Do not intercept authentication errors on the login routes itself
    if (originalRequest.url && originalRequest.url.endsWith('/login')) {
        return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401;
    const isInvalidUser = error.response?.status === 400 && error.response?.data?.message?.includes('Invalid user_id');

    if (isUnauthorized || isInvalidUser) {
        // Handle unauthorized or stale session access
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
    return Promise.reject(error);
});

export default api;
