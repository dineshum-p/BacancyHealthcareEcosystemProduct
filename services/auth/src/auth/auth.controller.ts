import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AccessTokenResponse,
  AuthTokens,
  RegisteredUser,
} from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

/**
 * Thin controller: validation via DTOs + delegation to `AuthService`.
 * Guarded by `TenantGuard` so every request is bound to a resolved, active
 * tenant (read from `public.tenants`) before any registration/login/refresh
 * is attempted for it.
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
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AccessTokenResponse> {
    return this.authService.refresh(dto);
  }
}
