import type { Request } from 'express';

export interface PaginationParams {
  page: number;
  per_page: number;
  offset: number;
}

export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20));
  return { page, per_page, offset: (page - 1) * per_page };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    total,
    page: params.page,
    per_page: params.per_page,
    total_pages: Math.ceil(total / params.per_page),
  };
}
