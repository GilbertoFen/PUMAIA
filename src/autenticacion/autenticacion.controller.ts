import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { RoleType } from '@prisma/client';
import { AutenticacionService } from './autenticacion.service';
import {
  GoogleLoginDto,
  DevLoginDto,
  RefreshTokenDto,
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  InviteStaffDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './interfaces/auth-user.interface';

@Controller('autenticacion')
export class AutenticacionController {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly cookieName = 'puma_refresh_token';

  constructor(private readonly autenticacionService: AutenticacionService) {}

  /**
   * Registro tradicional con correo institucional (@pcpuma.acatlan.unam.mx) y contraseña.
   * También permite activar cuentas invitadas de profesores/administradores.
   */
  @HttpCode(201)
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.autenticacionService.registerWithPassword(dto);
  }

  /**
   * Verificación obligatoria del correo electrónico mediante token.
   */
  @HttpCode(200)
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.autenticacionService.verifyEmail(dto);
  }

  /**
   * Reenvío de token de verificación de correo (protegido contra enumeración).
   */
  @HttpCode(200)
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.autenticacionService.resendVerification(dto);
  }

  /**
   * Inicio de sesión con correo y contraseña.
   * Comprueba correo verificado, bloqueo por fuerza bruta y emite JWT + Refresh Cookie httpOnly.
   */
  @HttpCode(200)
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.autenticacionService.loginWithPassword(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string | undefined),
    });

    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Solicitud de recuperación de contraseña (protegida contra enumeración de cuentas).
   */
  @HttpCode(200)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.autenticacionService.forgotPassword(dto);
  }

  /**
   * Restablecimiento de contraseña mediante token seguro.
   * Revoca todas las sesiones activas tras el cambio de contraseña.
   */
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.autenticacionService.resetPassword(dto);
  }

  /**
   * Creación de invitación para profesores o administradores (sin exigir número de cuenta estudiantil).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @HttpCode(201)
  @Post('invite-staff')
  async inviteStaff(
    @Body() dto: InviteStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.autenticacionService.inviteStaffMember(dto, user.userId);
  }

  /**
   * Inicio de sesión y autorregistro con Google (cuentas @pcpuma.acatlan.unam.mx para alumnos).
   */
  @HttpCode(200)
  @Post('google')
  async loginWithGoogle(
    @Req() req: Request,
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.autenticacionService.loginWithGoogle(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string | undefined),
    });

    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Login auxiliar de desarrollo para pruebas manuales en .http (no disponible en producción).
   */
  @HttpCode(200)
  @Post('dev-login')
  async devLogin(
    @Req() req: Request,
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.autenticacionService.devLogin(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || (req.headers['x-forwarded-for'] as string | undefined),
    });
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Renovación del Access Token (15m) mediante Refresh Token (7d) con rotación estricta.
   * Lee prioritariamente la cookie httpOnly; si no viene, lee del body.
   */
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenFromCookie =
      req.cookies?.[this.cookieName] ||
      this.extractCookieFromHeader(req.headers.cookie, this.cookieName);
    const refreshToken = tokenFromCookie || dto.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'No se proporcionó ningún token de renovación (cookie o body).',
      );
    }

    const result =
      await this.autenticacionService.refreshAccessToken(refreshToken);

    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  /**
   * Cierre de sesión: invalida únicamente la sesión actual (sin afectar otros dispositivos ni sobrescribir lastLoginAt),
   * limpia la cookie httpOnly y audita el evento.
   */
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenFromCookie =
      req.cookies?.[this.cookieName] ||
      this.extractCookieFromHeader(req.headers.cookie, this.cookieName) ||
      (req.body as any)?.refreshToken;

    const authHeader = req.headers.authorization;
    const extractedUserId = this.autenticacionService.extractUserIdFromRequestTokens(
      tokenFromCookie,
      authHeader,
    );
    const extractedSessionId = this.autenticacionService.extractSessionIdFromRequestTokens(
      tokenFromCookie,
      authHeader,
    );

    const userId = (req as any).user?.userId || extractedUserId;
    const sessionId =
      (req as any).user?.sessionId ||
      (req as any).user?.sid ||
      extractedSessionId;

    if (userId) {
      await this.autenticacionService.logout(
        userId,
        sessionId || null,
        tokenFromCookie || null,
      );
    }

    const cookieOpts = this.getCookieSecurityOptions();
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: '/',
    });

    return { message: 'Sesión cerrada e invalidada correctamente.' };
  }

  /**
   * Consulta el contexto del usuario autenticado: cuenta, roles y perfil de alumno.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.autenticacionService.getMe(user.userId);
  }

  private getCookieSecurityOptions(): {
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
  } {
    const rawSameSite = (
      process.env.COOKIE_SAMESITE || (this.isProduction ? 'none' : 'lax')
    ).toLowerCase();
    const sameSite: 'lax' | 'strict' | 'none' =
      rawSameSite === 'none'
        ? 'none'
        : rawSameSite === 'strict'
          ? 'strict'
          : 'lax';
    const secure = this.isProduction || sameSite === 'none';
    return { sameSite, secure };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    const { sameSite, secure } = this.getCookieSecurityOptions();

    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
  }

  private extractCookieFromHeader(
    cookieHeader: string | undefined,
    name: string,
  ): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
  }
}
