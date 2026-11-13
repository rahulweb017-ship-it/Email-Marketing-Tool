import api from './client';

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  mime_type: string;
  kind: 'image' | 'video' | 'document';
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const listMedia = (params: { page?: number; per_page?: number; kind?: string; search?: string } = {}) =>
  api.get<{ data: MediaAsset[]; total: number }>('/media', { params: { per_page: 60, ...params } }).then((r) => r.data);

export const uploadMedia = (file: File, onProgress?: (fraction: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<MediaAsset>('/media', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); },
  }).then((r) => r.data);
};

export const deleteMedia = (id: string) => api.delete(`/media/${id}`);
