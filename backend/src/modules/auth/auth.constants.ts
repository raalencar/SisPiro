export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  roles: import('@prisma/client').UserRole[];
};
