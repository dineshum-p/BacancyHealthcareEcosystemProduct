import { UserRole } from './user-role.enum';

/**
 * A row in a tenant's `<schema>.users` table. Never log or serialize
 * `passwordHash` back to a client (see `AuthService.toRegisteredUser`).
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}
