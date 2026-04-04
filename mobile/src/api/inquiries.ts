import { apiClient } from './client';

export const fetchInquiries = async () => {
  const response = await apiClient.get('/inquiries');
  return response.data.data.inquiries;
};

export const fetchInquiryById = async (id: number | string) => {
  const response = await apiClient.get(`/inquiries/${id}`);
  return response.data.data.inquiry;
};

export const updateInquiryStatus = async (id: number | string, status: string) => {
  const response = await apiClient.patch(`/inquiries/${id}`, { status });
  return response.data.data.inquiry;
};
