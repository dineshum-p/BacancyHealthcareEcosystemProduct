import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AccessTokenResponse,
  AuthTokens,
  LoginResult,
  MfaActivation,
  MfaEnrollment,
  RegisteredUser,
  RoleDefinition,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from './access-token.guard';
import { PermissionsGuard } from './permissions.guard';
import { InternalServiceGuard } from './internal-service.guard';
import { RequirePermissions } from './permissions.decorator';
import { Permission } from './permission.enum';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AdminSeedDto } from './dto/admin-seed.dto';
import type { RequestWithAuth } from './request-with-auth.interface';

/**
 * Thin controller: validation via DTOs + delegation to `AuthService`.
 * Guarded by `TenantGuard` so every request is bound to a resolved, active
 * tenant (read from `public.tenants`) before any registration/login/refresh
 * is attempted for it.
 *
 * `mfa/enroll` and `mfa/verify` additionally require `AccessTokenGuard`
 * (BAC-6): a caller must already hold a valid access token identifying
 * themselves before they can start/complete MFA enrollment for their own
 * account. `login` and `mfa/login-verify` deliberately do NOT -- they are
 * the pre-authentication flow itself.
 */
@UseGuards(TenantGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<RegisteredUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  /**
   * BAC-12: internal, service-to-service counterpart to `register()` --
   * seeds a `clinic_admin` for the tenant identified by `X-Tenant-Id`,
   * called ONLY by `services/tenant`'s onboarding orchestration (never by a
   * browser). Guarded by `TenantGuard` (class-level, resolves + validates
   * the target tenant like every other route here) plus `InternalServiceGuard`
   * (a shared-secret check) instead of `AccessTokenGuard`: there is no
   * end-user bearer token for this flow to check -- the caller authenticated
   * as a Super Admin against a DIFFERENT tenant entirely (their own), so a
   * token scoped to that tenant would (correctly) fail `AccessTokenGuard`'s
   * cross-tenant check if presented here. See `InternalServiceGuard`'s doc
   * comment for the full trust-boundary rationale, and `AuthService.
   * seedClinicAdmin`'s doc comment for why this isn't just `register()`
   * with a role parameter.
   */
  @Post('admin-seed')
  @UseGuards(InternalServiceGuard)
  @HttpCode(HttpStatus.CREATED)
  seedClinicAdmin(@Body() dto: AdminSeedDto): Promise<RegisteredUser> {
    return this.authService.seedClinicAdmin(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AccessTokenResponse> {
    return this.authService.refresh(dto);
  }

  @Post('mfa/enroll')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  enrollMfa(@Req() request: RequestWithAuth): Promise<MfaEnrollment> {
    return this.authService.enrollMfa(getAuthenticatedUserId(request));
  }

  @Post('mfa/verify')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  verifyMfaEnrollment(
    @Req() request: RequestWithAuth,
    @Body() dto: MfaVerifyDto,
  ): Promise<MfaActivation> {
    return this.authService.verifyMfaEnrollment(
      getAuthenticatedUserId(request),
      dto,
    );
  }

  @Post('mfa/login-verify')
  @HttpCode(HttpStatus.OK)
  completeMfaLogin(@Body() dto: MfaLoginVerifyDto): Promise<AuthTokens> {
    return this.authService.completeMfaLogin(dto);
  }

  /**
   * BAC-7, AC1: read-only RBAC metadata (the four roles and each one's
   * permission set) -- proves the role/permission catalog is queryable over
   * HTTP, not just an in-code constant. Guarded only by `AccessTokenGuard`
   * (any authenticated caller, no specific permission): this describes the
   * RBAC model itself, not a specific tenant's or user's data.
   */
  @Get('roles')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  listRoles(): RoleDefinition[] {
    return this.authService.listRoles();
  }

  /**
   * BAC-7, AC2/AC3/AC4: reassigns a user's role. Requires
   * `MANAGE_USER_ROLES` (`PermissionsGuard`, composed AFTER
   * `AccessTokenGuard` so `request.user.role` is already populated).
   * Tenant isolation and "does this user exist" are both enforced by
   * `AuthService.updateUserRole` (see its doc comment) -- this controller
   * stays thin (validation via `UpdateUserRoleDto`'s `@IsEnum` + delegation).
   */
  @Patch('users/:id/role')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_USER_ROLES)
  @HttpCode(HttpStatus.OK)
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<RegisteredUser> {
    return this.authService.updateUserRole(id, dto.role);
  }
}

/**
 * `AccessTokenGuard` always runs before the handler and always sets
 * `request.user` on success (or throws) -- this narrows the optional field
 * without repeating a null-check in every MFA handler above.
 */
function getAuthenticatedUserId(request: RequestWithAuth): string {
  if (!request.user) {
    throw new Error(
      'request.user was not set -- protect this route with AccessTokenGuard.',
    );
  }
  return request.user.userId;
}
