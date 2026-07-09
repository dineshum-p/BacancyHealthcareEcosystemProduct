import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';
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
