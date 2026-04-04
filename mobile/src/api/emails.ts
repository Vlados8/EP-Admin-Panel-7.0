import { apiClient } from './client';

export const fetchEmailMessages = async () => {
    const { data } = await apiClient.get('/emails/messages');
    return data.data; // contains messages and unreadCount
};

export const markEmailAsRead = async (id: number) => {
    const { data } = await apiClient.patch(`/emails/messages/${id}/read`);
    return data.data.message;
};

export const deleteEmailMessage = async (id: number) => {
    await apiClient.delete(`/emails/messages/${id}`);
};

export const sendEmail = async (formData: FormData) => {
    const response = await apiClient.post('/emails/send', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data.data.email;
};

export const fetchEmailAccounts = async () => {
    const { data } = await apiClient.get('/emails');
    return data.data.accounts;
};
