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
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  AccessTokenResponse,
  AuthTokens,
  CreateProviderAccountResponse,
  LoginResult,
  MfaActivation,
  MfaEnrollment,
  RegisteredUser,
  RoleDefinition,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from './access-token.guard';
import { PasswordResetTokenGuard } from './password-reset-token.guard';
import { PermissionsGuard } from './permissions.guard';
import { InternalServiceGuard } from './internal-service.guard';
import { RequirePermissions } from './permissions.decorator';
import { Permission } from './permission.enum';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PatientSignUpDto } from './dto/patient-sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AdminSeedDto } from './dto/admin-seed.dto';
import { CreateProviderAccountDto } from './dto/create-provider-account.dto';
import { ResetTemporaryPasswordDto } from './dto/reset-temporary-password.dto';
import type { RequestWithAuth } from './request-with-auth.interface';
import type { RequestWithPasswordResetAuth } from './request-with-password-reset-auth.interface';

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
 * the pre-authentication flow itself. `reset-temporary-password` (BAC-49)
 * requires `PasswordResetTokenGuard` instead of `AccessTokenGuard` -- a
 * DIFFERENT, narrowly-scoped guard verifying the DIFFERENT, narrowly-scoped
 * credential `login` hands back for a `mustResetPassword` account (see
 * `AuthService.login`'s and `PasswordResetTokenGuard`'s doc comments): that
 * credential is deliberately rejected by `AccessTokenGuard` (and therefore
 * by every OTHER route in this controller), so it cannot be replayed as a
 * general Bearer access token.
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

  /**
   * BAC-42: the PUBLIC, unauthenticated patient sign-up endpoint -- creates a
   * real, login-capable auth-service user (`role: 'patient'`), distinct from
   * BAC-36's anonymous `services/patient` self-registration (which creates no
   * login account at all). Guarded by the class-level `TenantGuard` (same
   * tenant-scoping convention as every other route in this controller,
   * resolved from `X-Tenant-Id` -- there is no `:tenantSlug` route param here,
   * unlike `services/patient`'s public controller) plus a route-level
   * `ThrottlerGuard` (BAC-36's rate-limiting convention, replicated here via
   * `getPatientSignUpThrottleConfig`/`AuthModule`'s `ThrottlerModule.
   * forRootAsync`) -- NOT `AccessTokenGuard`: a caller signing up has no
   * session/JWT yet, by definition. See `AuthService.registerPatient`'s doc
   * comment for why this is a distinct method from `register()`, and for why
   * it does NOT auto-issue tokens (matches `register()`'s existing
   * behaviour: the caller still calls `POST /auth/login` afterwards).
   */
  @Post('patients/register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  registerPatient(@Body() dto: PatientSignUpDto): Promise<RegisteredUser> {
    return this.authService.registerPatient(dto);
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

  /**
   * BAC-48: admin-only, direct account-creation endpoint -- a `clinic_admin`/
   * `super_admin` creates a new PROVIDER (doctor) login account in one step,
   * skipping self-registration entirely (there is otherwise NO path that
   * ever assigns `role: 'provider'`). Guarded by `AccessTokenGuard` +
   * `PermissionsGuard` requiring `CREATE_STAFF_ACCOUNT` (403 for
   * `provider`/`staff`/`patient` callers and any unauthenticated caller),
   * same guard-ordering convention as `updateUserRole`.
   * `CreateProviderAccountDto`'s `@IsIn([UserRole.PROVIDER])` on `role`
   * rejects (400) any other role value before this ever reaches
   * `AuthService` -- this endpoint is deliberately scoped to provisioning
   * `provider` accounts only, not a general "create any role" door (see
   * `AuthService.createProviderAccount`'s doc comment).
   */
  @Post('users')
  @UseGuards(AccessTokenGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_STAFF_ACCOUNT)
  @HttpCode(HttpStatus.CREATED)
  createProviderAccount(
    @Body() dto: CreateProviderAccountDto,
  ): Promise<CreateProviderAccountResponse> {
    return this.authService.createProviderAccount(dto);
  }

  /**
   * BAC-49, AC2/AC4: completes the forced-reset flow for an account whose
   * `POST /auth/login` returned a `PasswordResetRequiredChallenge`
   * (`mustResetPassword: true`, BAC-48) -- or, more generally, any
   * caller holding a valid password-reset token changing their own password
   * (see `AuthService.resetTemporaryPassword`'s doc comment for why this is
   * not further restricted to ONLY the forced-reset case). Guarded by
   * `PasswordResetTokenGuard`, NOT `AccessTokenGuard` -- same
   * 401-on-missing/invalid-token behaviour (AC4 mirrors `AccessTokenGuard`'s
   * existing precedent exactly), but verifying a cryptographically distinct,
   * single-purpose credential (see `PasswordResetTokenGuard`'s doc comment
   * for why): the restricted token `login()` hands back for a
   * `mustResetPassword` account is Bearer-usable HERE and ONLY here --
   * `AccessTokenGuard` (and every route guarded by it) rejects it outright.
   * No `RequirePermissions` -- this is exclusively a self-service,
   * own-account operation (never a staff/admin resetting someone ELSE's
   * password), identified entirely by `request.user.userId`, never by
   * anything in the request body.
   */
  @Post('reset-temporary-password')
  @UseGuards(PasswordResetTokenGuard)
  @HttpCode(HttpStatus.OK)
  resetTemporaryPassword(
    @Req() request: RequestWithPasswordResetAuth,
    @Body() dto: ResetTemporaryPasswordDto,
  ): Promise<AuthTokens> {
    return this.authService.resetTemporaryPassword(
      getAuthenticatedPasswordResetUserId(request),
      dto,
    );
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

/**
 * `PasswordResetTokenGuard` always runs before `resetTemporaryPassword` and
 * always sets `request.user` on success (or throws) -- mirrors
 * `getAuthenticatedUserId` above, but narrowed to
 * `RequestWithPasswordResetAuth` (a `PasswordResetTokenPayload`, not a full
 * `AccessTokenPayload`).
 */
function getAuthenticatedPasswordResetUserId(
  request: RequestWithPasswordResetAuth,
): string {
  if (!request.user) {
    throw new Error(
      'request.user was not set -- protect this route with PasswordResetTokenGuard.',
    );
  }
  return request.user.userId;
}
