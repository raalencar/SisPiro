import { Prisma } from '@prisma/client';
import { auditContext } from './audit-context.js';

export function createAuditLog(
  tx: Prisma.TransactionClient,
  args: { data: Prisma.AuditLogUncheckedCreateInput },
) {
  const actorId = auditContext.getStore()?.actorId;
  return tx.auditLog.create({
    ...args,
    data: {
      ...args.data,
      ...(args.data.actorId === undefined && actorId ? { actorId } : {}),
    },
  });
}
