import { IsEnum } from 'class-validator';
import { UserRole } from '../user-role.enum';

/**
 * BAC-7, AC4: body for `PATCH /auth/users/:id/role`. `@IsEnum(UserRole)`
 * rejects an unknown/invalid role value with a 400 before the controller
 * ever delegates to `AuthService.updateUserRole`.
 */
export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
