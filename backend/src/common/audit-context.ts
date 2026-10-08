import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditContext {
  actorId?: string;
}

export const auditContext = new AsyncLocalStorage<AuditContext>();
