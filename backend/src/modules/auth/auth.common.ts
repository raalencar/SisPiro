import { createHash, timingSafeEqual } from 'node:crypto';
import { UserRole } from '@prisma/client';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ADMIN_CHANGE_LOCK_ID = 8217340621;

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
};

export function hashRefreshSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function parseRefreshToken(value: string): { sessionId: string; secret: string } | null {
  const separator = value.indexOf('.');
  if (separator < 0) {
    return null;
  }
  const sessionId = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (!UUID_PATTERN.test(sessionId) || !/^[A-Za-z0-9_-]{64}$/.test(secret)) {
    return null;
  }
  return { sessionId, secret };
}

export function userSummary(user: UserSummary): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
  };
}
