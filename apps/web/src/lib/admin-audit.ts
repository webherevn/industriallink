import type { AuditLogListPage, AuditLogListQuery } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchAuditLog(params: AuditLogListQuery = {}): Promise<AuditLogListPage> {
  const qs = new URLSearchParams();
  if (params.entityType) qs.set('entityType', params.entityType);
  if (params.action) qs.set('action', params.action);
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiRequest(`/admin/audit${suffix}`);
}
