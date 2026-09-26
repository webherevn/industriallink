export interface AuditLogItem {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  correlationId: string | null;
}

export interface AuditLogListPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogListQuery {
  entityType?: string;
  action?: string;
  q?: string;
  page?: number;
  limit?: number;
}
