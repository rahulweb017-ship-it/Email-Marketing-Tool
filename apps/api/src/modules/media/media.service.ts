import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import { ALLOWED_MEDIA, cleanFileName, imageSize, sniffMediaType } from './media.utils.js';

interface MediaRow {
  id: string;
  org_id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  kind: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: Date;
}

export function mediaUrl(row: Pick<MediaRow, 'org_id' | 'stored_name'>): string {
  return `${env.APP_URL.replace(/\/+$/, '')}/media/${row.org_id}/${row.stored_name}`;
}

function present(row: MediaRow) {
  return {
    id: row.id,
    name: row.original_name,
    url: mediaUrl(row),
    mime_type: row.mime_type,
    kind: row.kind,
    size_bytes: row.size_bytes,
    width: row.width,
    height: row.height,
    created_at: row.created_at,
  };
}

export async function uploadMedia(orgId: string, userId: string | null, file: { buffer: Buffer; originalname: string; size: number }) {
  const mime = sniffMediaType(file.buffer);
  const type = mime ? ALLOWED_MEDIA[mime] : undefined;
  if (!mime || !type) {
    throw new AppError(400, 'Unsupported file. Upload a JPG, PNG, GIF, WebP image, an MP4 video or a PDF.');
  }

  const storedName = `${uuidv4()}.${type.ext}`;
  const dir = path.join(env.MEDIA_DIR, orgId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedName), file.buffer);

  const size = type.kind === 'image' ? imageSize(file.buffer, mime) : null;
  const [row] = await db('media_assets').insert({
    id: uuidv4(),
    org_id: orgId,
    created_by: userId,
    original_name: cleanFileName(file.originalname),
    stored_name: storedName,
    mime_type: mime,
    kind: type.kind,
    size_bytes: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  }).returning('*');
  return present(row);
}

export async function listMedia(orgId: string, pagination: PaginationParams, filters: { kind?: string; search?: string }) {
  const base = db('media_assets').where('org_id', orgId);
  if (filters.kind) base.where('kind', filters.kind);
  if (filters.search) base.whereILike('original_name', `%${filters.search}%`);
  const [{ count }] = await base.clone().count('id as count');
  const rows = await base.orderBy('created_at', 'desc').limit(pagination.per_page).offset(pagination.offset);
  return { data: rows.map(present), total: Number(count) };
}

export async function deleteMedia(orgId: string, id: string) {
  const row = await db('media_assets').where({ id, org_id: orgId }).first();
  if (!row) throw new AppError(404, 'File not found');
  await db('media_assets').where('id', id).delete();
  await fs.unlink(path.join(env.MEDIA_DIR, orgId, row.stored_name)).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
}
