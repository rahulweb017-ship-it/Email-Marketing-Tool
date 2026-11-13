import api from './client';

export interface EnquiryInput {
  type: 'registration' | 'contact';
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  company_size?: string;
  monthly_volume?: string;
  interests?: string[];
  subject?: string;
  message?: string;
  source_page?: string;
  /** Hidden honeypot field; must stay empty */
  fax_number?: string;
}

export interface Enquiry extends Required<Omit<EnquiryInput, 'fax_number'>> {
  id: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  admin_notes: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export const submitEnquiry = (data: EnquiryInput) => api.post('/public/enquiries', data);

export const listEnquiries = (params?: Record<string, string>) =>
  api.get<{ data: Enquiry[]; total: number; page: number; per_page: number; total_pages: number; counts: Record<string, number> }>(
    '/super-admin/enquiries',
    { params },
  );

export const updateEnquiry = (id: string, data: { status?: Enquiry['status']; admin_notes?: string | null }) =>
  api.patch<Enquiry>(`/super-admin/enquiries/${id}`, data);

export const deleteEnquiry = (id: string) => api.delete(`/super-admin/enquiries/${id}`);

export function enquiryErrorMessage(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    || 'Something went wrong. Please try again or email us directly.';
}
