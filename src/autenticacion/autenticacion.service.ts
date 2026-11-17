import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RoleType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import {
  GoogleLoginDto,
  DevLoginDto,
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  InviteStaffDto,
} from './dto/auth.dto';
import { JwtPayload } from './interfaces/auth-user.interface';
import { parseUnamAccountName } from './normalizar-nombre';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    roles: RoleType[];
    studentId: string | null;
    professorId?: string | null;
    accountNumber: number | null;
    hasCompletedQuiz?: boolean;
    needsNameConfirmation?: boolean;
  };
}

export interface EmailDispatchResult {
  /** true solo si el proveedor (SMTP o webhook) aceptó el correo. */
  delivered: boolean;
  channel: 'SMTP' | 'WEBHOOK' | null;
  /** Código seguro (sin contenido) del último error, p. ej. NO_PROVIDER_CONFIGURED o WEBHOOK_HTTP_401. */
  errorCode: string | null;
  /** Código HTTP que respondió el webhook (null si no hubo respuesta o no aplica). */
  httpStatus?: number | null;
}

/** Nombre visible del remitente. n8n envía desde la cuenta de Gmail conectada. */
export const EMAIL_SENDER_NAME = 'PumaIA · FES Acatlán';
/** Tiempo máximo de espera de la respuesta del webhook de correo de n8n. */
export const N8N_EMAIL_TIMEOUT_MS = 10_000;

export interface InvitationEmailResult {
  emailSent: boolean;
  emailError: string | null;
}

/** Rol en español para correos y pantallas. */
export const STAFF_ROLE_LABEL: Partial<Record<RoleType, string>> = {
  [RoleType.PROFESSOR]: 'Profesor',
  [RoleType.INSTITUTION_ADMIN]: 'Administrador',
  [RoleType.ANALYST]: 'Analista',
};

/** Escapa texto para insertarlo en el HTML del correo. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SessionMirror {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousTokenHash: string | null;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

// Hash bcrypt precalculado para defensa contra enumeración por tiempo (timing attack)
const DUMMY_BCRYPT_HASH =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oL8E9.K2G';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

@Injectable()
export class AutenticacionService implements OnModuleInit {
  private readonly logger = new Logger(AutenticacionService.name);
  private readonly studentDomain = '@pcpuma.acatlan.unam.mx';
  private readonly sessionMirror = new Map<string, SessionMirror>();
  private readonly inFlightRotations = new Set<string>();
  private readonly testEmailOutbox = new Map<
    string,
    {
      to: string;
      subject: string;
      text: string;
      actionUrl: string;
      token: string | null;
      category: 'VERIFICATION' | 'PASSWORD_RESET' | 'STAFF_INVITATION';
      expiresAt: Date | null;
      sentAt: Date;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /** Al arrancar, indica qué canal de correo está activo (solo nombres de variables, nunca valores). */
  onModuleInit() {
    const has = (k: string) =>
      Boolean(this.configService.get<string>(k)?.trim());
    const url = has('N8N_EMAIL_WEBHOOK_URL');
    const key = has('N8N_EMAIL_WEBHOOK_API_KEY');
    if (url && key) {
      this.logger.log(
        'Correo: webhook de n8n configurado (N8N_EMAIL_WEBHOOK_URL + N8N_EMAIL_WEBHOOK_API_KEY).',
      );
      return;
    }
    const missing = [
      !url && 'N8N_EMAIL_WEBHOOK_URL',
      !key && 'N8N_EMAIL_WEBHOOK_API_KEY',
    ].filter(Boolean);
    this.logger.warn(
      `Correo: sin proveedor configurado; falta ${missing.join(' y ')}. Las invitaciones se crean igual con emailSent:false.`,
    );
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private assertPasswordAuthEnabled(): void {
    const flag = this.configService.get<string>('ENABLE_PASSWORD_AUTH');
    if (flag === 'false') {
      throw new ForbiddenException(
        'El acceso con contraseña está deshabilitado. Usa el inicio de sesión con Google.',
      );
    }
  }

  private needsNameConfirmation(user: any): boolean {
    return (
      !!user?.student &&
      user.name === 'Alumno' &&
      user.lastNameP === String(user.student.accountNumber)
    );
  }

  private safeCompareHex(
    a: string | null | undefined,
    b: string | null | undefined,
  ): boolean {
    if (!a || !b || a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Valida estrictamente que un correo de ESTUDIANTE:
   * 1. Esté normalizado en minúsculas y sin espacios.
   * 2. Pertenezca exactamente al dominio @pcpuma.acatlan.unam.mx.
   * 3. Su localPart sea un número de cuenta válido (1 a 9 dígitos numéricos, mayor a 0).
   */
  public isValidStudentInstitutionalEmail(rawEmail: string): boolean {
    if (!rawEmail || typeof rawEmail !== 'string') return false;
    const normalized = rawEmail.trim().toLowerCase();
    const parts = normalized.split('@');
    if (parts.length !== 2) return false;
    const [localPart, domainPart] = parts;
    if (`@${domainPart}` !== this.studentDomain) return false;
    if (!/^\d{1,9}$/.test(localPart)) return false;
    const accountNum = parseInt(localPart, 10);
    return !Number.isNaN(accountNum) && accountNum > 0;
  }

  /**
   * Comprueba únicamente si el dominio del correo es exactamente @pcpuma.acatlan.unam.mx.
   */
  public hasStudentInstitutionalDomain(rawEmail: string): boolean {
    if (!rawEmail || typeof rawEmail !== 'string') return false;
    const normalized = rawEmail.trim().toLowerCase();
    const parts = normalized.split('@');
    if (parts.length !== 2) return false;
    return parts[0].length > 0 && `@${parts[1]}` === this.studentDomain;
  }

  /**
   * Extrae el número de cuenta (Int, sin ceros a la izquierda) de un correo estudiantil válido.
   */
  public extractStudentAccountNumber(rawEmail: string): number {
    if (!this.isValidStudentInstitutionalEmail(rawEmail)) {
      throw new BadRequestException(
        `El correo institucional debe tener formato <numero_cuenta>${this.studentDomain} (hasta 9 dígitos numéricos).`,
      );
    }
    const [localPart] = rawEmail.trim().toLowerCase().split('@');
    return parseInt(localPart, 10);
  }

  /**
   * Valida fortaleza de contraseña: mínimo 8 caracteres, al menos una letra y un dígito.
   */
  public validatePasswordStrength(password: string): void {
    if (!password || typeof password !== 'string' || password.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException(
        'La contraseña debe incluir al menos una letra y un número.',
      );
    }
  }

  // =========================================================================
  // 1. REGISTRO TRADICIONAL CON CORREO INSTITUCIONAL Y CONTRASEÑA
  // =========================================================================

  async registerWithPassword(dto: RegisterDto) {
    this.assertPasswordAuthEnabled();
    const email = (dto.email || '').trim().toLowerCase();

    if (!this.isValidStudentInstitutionalEmail(email)) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'REGISTER_REJECTED_INVALID_INSTITUTIONAL_EMAIL',
        detail: { email },
      });
      throw new BadRequestException(
        `Únicamente se permiten correos institucionales de alumnos con formato <numero_cuenta>${this.studentDomain} (máximo 9 dígitos).`,
      );
    }

    const extractedAccountNumber = this.extractStudentAccountNumber(email);
    if (
      dto.accountNumber !== undefined &&
      dto.accountNumber !== null &&
      Number(dto.accountNumber) !== extractedAccountNumber
    ) {
      throw new BadRequestException(
        'El número de cuenta ingresado no coincide con el número de cuenta del correo institucional.',
      );
    }

    this.validatePasswordStrength(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Buscar si ya existe el usuario o el número de cuenta
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true, student: true },
    });

    const existingStudent = this.prisma.student?.findUnique
      ? await this.prisma.student.findUnique({
          where: { accountNumber: extractedAccountNumber },
        })
      : null;

    // Si la cuenta o el número de cuenta ya existen y están activos/registrados, rechazar con conflicto
    if (
      (existingUser &&
        (existingUser.emailVerifiedAt ||
          (existingUser as any).googleSub ||
          (existingUser as any).passwordHash)) ||
      existingStudent
    ) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: existingUser?.id,
        action: 'REGISTER_ATTEMPT_ALREADY_REGISTERED',
        detail: { email, accountNumber: extractedAccountNumber },
      });

      throw new ConflictException(
        'El correo institucional o número de cuenta ya se encuentra registrado en el sistema.',
      );
    }

    const institution = await this.getOrCreateDefaultInstitution();
    const careerId = await this.resolveCareerId(institution.id, dto.careerId);

    let registeredUser: any;

    if (existingUser) {
      // Cuenta preexistente (ej. invitada en lista)
      registeredUser = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: dto.name.trim(),
          lastNameP: dto.lastNameP.trim(),
          lastNameM: dto.lastNameM?.trim() || existingUser.lastNameM || null,
          passwordHash,
          emailVerifiedAt: existingUser.emailVerifiedAt || new Date(),
          status: UserStatus.ACTIVE,
        } as any,
        include: { roles: true, student: true },
      });

      if (!existingUser.student) {
        const createdStudent = await this.prisma.student.create({
          data: {
            userId: existingUser.id,
            accountNumber: extractedAccountNumber,
            careerId,
            currentSemester: dto.currentSemester || 1,
            isGraduated: false,
            hasCompletedQuiz: false,
          },
        });
        registeredUser.student = createdStudent;
      }
    } else {
      registeredUser = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            institutionId: institution.id,
            email,
            passwordHash,
            emailVerifiedAt: new Date(),
            name: dto.name.trim(),
            lastNameP: dto.lastNameP.trim(),
            lastNameM: dto.lastNameM?.trim() || null,
            status: UserStatus.ACTIVE,
            roles: {
              create: {
                role: RoleType.STUDENT,
              },
            },
          } as any,
        });

        const createdStudent = await tx.student.create({
          data: {
            userId: createdUser.id,
            accountNumber: extractedAccountNumber,
            careerId,
            currentSemester: dto.currentSemester || 1,
            isGraduated: false,
            hasCompletedQuiz: false,
          },
        });

        return { ...createdUser, student: createdStudent };
      });
    }

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: registeredUser.id,
      action: 'STUDENT_REGISTERED',
      detail: { email, accountNumber: extractedAccountNumber },
    });

    // Control de verificación de correo mediante feature flag (preparado para futura activación)
    const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

    if (requireEmailVerification) {
      return {
        message: 'Usuario registrado. Por favor verifica tu correo institucional para activar tu cuenta.',
        requiresVerification: true,
        user: {
          id: registeredUser.id,
          email: registeredUser.email,
          name: `${registeredUser.name} ${registeredUser.lastNameP}`.trim(),
          accountNumber: extractedAccountNumber,
        },
      };
    }

    // Flujo activo sin código: creación directa de sesión y emisión de tokens
    const roles: RoleType[] = [RoleType.STUDENT];

    const tokens = await this.createSessionAndTokens({
      userId: registeredUser.id,
      studentId: registeredUser.student?.id || null,
      professorId: null,
      email: registeredUser.email,
      name: `${registeredUser.name} ${registeredUser.lastNameP}`.trim(),
      roles,
      accountNumber: extractedAccountNumber,
    });

    return {
      message: 'Usuario registrado y autenticado correctamente.',
      requiresVerification: false,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: registeredUser.id,
        email: registeredUser.email,
        name: `${registeredUser.name} ${registeredUser.lastNameP}`.trim(),
        accountNumber: extractedAccountNumber,
        roles,
        hasCompletedQuiz: false,
        currentSemester: registeredUser.student?.currentSemester ?? 1,
      },
    };
  }

  // =========================================================================
  // 2. VERIFICACIÓN OBLIGATORIA DE CORREO INSTITUCIONAL
  // =========================================================================

  async verifyEmail(dto: VerifyEmailDto) {
    this.assertPasswordAuthEnabled();
    const email = (dto.email || '').trim().toLowerCase();
    const token = (dto.token || '').trim();

    if (!email || !token) {
      throw new BadRequestException(
        'El correo y el token de verificación son obligatorios.',
      );
    }

    const user: any = await this.prisma.user.findUnique({
      where: { email },
    });

    const tokenHash = this.sha256(token);

    if (
      !user ||
      !user.verificationTokenHash ||
      !this.safeCompareHex(user.verificationTokenHash, tokenHash) ||
      !user.verificationExpiresAt ||
      new Date(user.verificationExpiresAt) <= new Date()
    ) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user?.id,
        action: 'EMAIL_VERIFICATION_FAILED',
        detail: { email },
      });
      throw new BadRequestException(
        'El código de verificación es inválido o ha expirado.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        status:
          user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
        verificationTokenHash: null,
        verificationExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any,
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: user.id,
      action: 'EMAIL_VERIFIED',
      detail: { email },
    });

    return {
      verified: true,
      message:
        'Correo institucional verificado con éxito. Ya puedes iniciar sesión.',
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    this.assertPasswordAuthEnabled();
    const email = (dto.email || '').trim().toLowerCase();
    const user: any = await this.prisma.user.findUnique({ where: { email } });

    const genericResponse = {
      message:
        'Si la cuenta existe y está pendiente de verificación, hemos enviado un nuevo enlace a tu correo institucional.',
    };

    if (!user || user.emailVerifiedAt || user.status === UserStatus.DELETED) {
      return genericResponse;
    }

    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = this.sha256(rawVerificationToken);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash,
        verificationExpiresAt,
      } as any,
    });

    const verificationUrl = this.buildFrontendAuthLink(
      'verify',
      email,
      rawVerificationToken,
    );
    await this.dispatchInstitutionalEmail(
      email,
      'Nuevo código de verificación PUMAIA',
      `Para verificar tu cuenta institucional en PUMAIA, ingresa al siguiente enlace:\n${verificationUrl}\n\nCódigo de verificación: ${rawVerificationToken}\nEste enlace y código expiran en 24 horas.`,
      {
        category: 'VERIFICATION',
        actionUrl: verificationUrl,
        token: rawVerificationToken,
        expiresAt: verificationExpiresAt,
      },
    );

    return genericResponse;
  }

  // =========================================================================
  // 3. LOGIN CON CORREO Y CONTRASEÑA (CON PROTECCIÓN BRUTE-FORCE Y ANTI-ENUMERACIÓN)
  // =========================================================================

  async loginWithPassword(
    dto: LoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    this.assertPasswordAuthEnabled();
    let email = (dto.email || '').trim().toLowerCase();
    let accountNum: number | undefined =
      dto.accountNumber !== undefined && dto.accountNumber !== null
        ? Number(dto.accountNumber)
        : undefined;

    if (!email && accountNum) {
      email = `${accountNum}${this.studentDomain}`;
    } else if (email && !email.includes('@') && /^\d+$/.test(email)) {
      accountNum = parseInt(email, 10);
      email = `${email}${this.studentDomain}`;
    } else if (email && email.includes('@')) {
      const localPart = email.split('@')[0];
      if (/^\d+$/.test(localPart)) {
        accountNum = parseInt(localPart, 10);
      }
    }

    if ((!email && !accountNum) || !dto.password) {
      throw new BadRequestException(
        'Debes proporcionar tu correo institucional o número de cuenta y tu contraseña.',
      );
    }

    const user: any = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(accountNum !== undefined
            ? [{ student: { accountNumber: accountNum } }]
            : []),
        ],
      },
      include: {
        roles: true,
        student: true,
        professor: true,
      },
    });

    // Defensa contra enumeración de cuentas y ataques de tiempo
    if (
      !user ||
      user.status === UserStatus.DELETED ||
      Boolean(user.deletedAt)
    ) {
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'LOGIN_FAILED_UNKNOWN_OR_DELETED',
        detail: { email },
      });
      throw new UnauthorizedException(
        'Credenciales inválidas o cuenta no autorizada.',
      );
    }

    // Verificar bloqueo temporal por fuerza bruta
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user.id,
        action: 'LOGIN_BLOCKED_BRUTE_FORCE_LOCKOUT',
        detail: { email, lockedUntil: user.lockedUntil },
      });
      throw new UnauthorizedException(
        'La cuenta se encuentra temporalmente bloqueada por múltiples intentos fallidos. Intenta más tarde.',
      );
    }

    if (!user.passwordHash) {
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new UnauthorizedException(
        'Credenciales inválidas o cuenta no autorizada.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          ...(shouldLock ? { lockedUntil } : {}),
        } as any,
      });

      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user.id,
        action: shouldLock
          ? 'ACCOUNT_LOCKED_BRUTE_FORCE'
          : 'LOGIN_FAILED_BAD_PASSWORD',
        detail: { email, failedAttempts },
      });

      throw new UnauthorizedException(
        'Credenciales inválidas o cuenta no autorizada.',
      );
    }

    // Si el correo aún no tenía marca de verificación, se valida automáticamente para permitir acceso inmediato
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() } as any,
      });
      user.emailVerifiedAt = new Date();
    }

    const roles: RoleType[] = (user.roles || []).map((r: any) => r.role);
    const staffRoles: RoleType[] = [
      RoleType.PROFESSOR,
      RoleType.INSTITUTION_ADMIN,
      RoleType.ANALYST,
    ];
    const isStaff = roles.some((r) => staffRoles.includes(r));

    // Si es exclusivamente estudiante, exigir dominio y número de cuenta válido
    if (!isStaff && !this.isValidStudentInstitutionalEmail(user.email)) {
      throw new UnauthorizedException(
        'El correo de estudiante no cumple el formato institucional requerido.',
      );
    }

    // Login exitoso: restablecer contador de intentos fallidos y registrar último acceso
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        status:
          user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
      } as any,
    });

    const tokens = await this.createSessionAndTokens(
      {
        userId: user.id,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`.trim(),
        roles,
        accountNumber: user.student?.accountNumber ?? null,
      },
      meta,
    );

    await this.auditService.log({
      actorType: isStaff ? 'ADMIN' : 'STUDENT',
      actorId: user.id,
      action: 'LOGIN_PASSWORD_SUCCESS',
      detail: { email: user.email, roles, sessionId: tokens.sessionId },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`.trim(),
        avatarUrl: user.avatarUrl,
        roles,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        accountNumber: user.student?.accountNumber ?? null,
        hasCompletedQuiz: user.student?.hasCompletedQuiz ?? false,
        needsNameConfirmation: this.needsNameConfirmation(user),
      },
    };
  }

  // =========================================================================
  // 4. RECUPERACIÓN Y RESTABLECIMIENTO DE CONTRASEÑA + INVITACIÓN DE STAFF
  // =========================================================================

  async forgotPassword(dto: ForgotPasswordDto) {
    this.assertPasswordAuthEnabled();
    const email = (dto.email || '').trim().toLowerCase();
    const genericResponse = {
      message:
        'Si el correo institucional se encuentra registrado, recibirás las instrucciones para restablecer tu contraseña.',
    };

    if (!email) return genericResponse;

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.status === UserStatus.DELETED ||
      Boolean(user.deletedAt)
    ) {
      return genericResponse;
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordTokenHash = this.sha256(rawResetToken);
    const resetPasswordExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordTokenHash,
        resetPasswordExpiresAt,
      } as any,
    });

    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      detail: { email },
    });

    const resetUrl = this.buildFrontendAuthLink('reset', email, rawResetToken);
    await this.dispatchInstitutionalEmail(
      email,
      'Recuperación de contraseña PUMAIA',
      `Recibimos una solicitud para restablecer tu contraseña en PUMAIA.\nIngresa al siguiente enlace para configurar una nueva contraseña:\n${resetUrl}\n\nCódigo de recuperación: ${rawResetToken}\nEste enlace y código expiran en 30 minutos.`,
      {
        category: 'PASSWORD_RESET',
        actionUrl: resetUrl,
        token: rawResetToken,
        expiresAt: resetPasswordExpiresAt,
      },
    );

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.assertPasswordAuthEnabled();
    const email = (dto.email || '').trim().toLowerCase();
    const token = (dto.token || '').trim();

    this.validatePasswordStrength(dto.newPassword);

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    const tokenHash = this.sha256(token);

    if (
      !user ||
      !user.resetPasswordTokenHash ||
      !this.safeCompareHex(user.resetPasswordTokenHash, tokenHash) ||
      !user.resetPasswordExpiresAt ||
      new Date(user.resetPasswordExpiresAt) <= new Date()
    ) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user?.id,
        action: 'PASSWORD_RESET_FAILED_INVALID_TOKEN',
        detail: { email },
      });
      throw new BadRequestException(
        'El token de recuperación es inválido o ha expirado.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        status:
          user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
      } as any,
    });

    // Revocar todas las sesiones activas del usuario tras cambio de contraseña
    await this.revokeAllUserSessions(user.id, 'PASSWORD_RESET');

    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
      detail: { email },
    });

    return {
      reset: true,
      message:
        'Contraseña actualizada correctamente. Todas las sesiones previas han sido cerradas.',
    };
  }

  /**
   * Permite a un administrador invitar a un profesor, administrador o analista sin forzarle registro de alumno.
   */
  async inviteStaffMember(dto: InviteStaffDto, grantedByUserId: string) {
    if (dto.role === RoleType.STUDENT) {
      throw new BadRequestException(
        'Las invitaciones administrativas están reservadas para personal académico o administrativo.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const institution = await this.getOrCreateDefaultInstitution();
    // La invitación ya no lleva contraseña ni token: la persona entra con Google usando este correo.

    const userId: string = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
        include: { roles: true, professor: true },
      });

      // --- Profesor: NUNCA se crea una fila nueva sin decisión explícita ---
      let professorToLink: { id: string } | null = null;
      let createProfessor = false;
      if (dto.role === RoleType.PROFESSOR && !existing?.professor) {
        if (dto.professorId) {
          const prof = await tx.professor.findUnique({
            where: { id: dto.professorId },
          });
          if (!prof) {
            throw new NotFoundException('El profesor indicado no existe.');
          }
          if (prof.userId) {
            throw new ConflictException(
              'Ese profesor ya está ligado a otra cuenta de usuario.',
            );
          }
          professorToLink = prof;
        } else if (dto.createNewProfessor === true) {
          createProfessor = true;
        } else {
          const candidates = await tx.professor.findMany({
            where: {
              userId: null,
              lastNameP: {
                contains: dto.lastNameP.trim(),
                mode: 'insensitive',
              },
            },
            select: { id: true, name: true, lastNameP: true, lastNameM: true },
            take: 10,
          });
          throw new BadRequestException({
            message:
              'Para invitar a un profesor indica "professorId" (el profesor ya cargado en el sistema) o "createNewProfessor": true si es un profesor nuevo.',
            candidates,
          });
        }
      }

      // --- Usuario y rol ---
      let uid: string;
      if (existing) {
        uid = existing.id;
        if (!existing.roles.some((r) => r.role === dto.role)) {
          await tx.userRole.create({
            data: { userId: uid, role: dto.role, grantedBy: grantedByUserId },
          });
        }
      } else {
        const created = await tx.user.create({
          data: {
            institutionId: institution.id,
            email,
            name: dto.name.trim(),
            lastNameP: dto.lastNameP.trim(),
            lastNameM: dto.lastNameM?.trim() || null,
            status: UserStatus.INVITED,
            roles: {
              create: { role: dto.role, grantedBy: grantedByUserId },
            },
          } as any,
        });
        uid = created.id;
      }

      // --- Ligar (o crear, solo si se pidió) la fila de profesor ---
      if (professorToLink) {
        await tx.professor.update({
          where: { id: professorToLink.id },
          data: { userId: uid },
        });
      } else if (createProfessor) {
        await tx.professor.create({
          data: {
            userId: uid,
            name: dto.name.trim(),
            lastNameP: dto.lastNameP.trim(),
            lastNameM: dto.lastNameM?.trim() || null,
            active: true,
          },
        });
      }

      return uid;
    });

    const user: any = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, professor: true },
    });

    await this.auditService.log({
      actorType: 'ADMIN',
      actorId: grantedByUserId,
      action: 'STAFF_INVITED',
      detail: {
        email,
        role: dto.role,
        invitedUserId: user.id,
        professorId: user.professor?.id ?? null,
      },
    });

    // El correo se envía siempre (también con ENABLE_PASSWORD_AUTH apagado).
    // Si falla, la invitación queda creada igual y se responde emailSent: false.
    const emailResult = await this.sendStaffInvitationEmail(
      user.id,
      grantedByUserId,
      { role: dto.role },
    );

    return {
      message: emailResult.emailSent
        ? 'Invitación registrada y correo enviado. La persona entra con Google usando exactamente este correo.'
        : 'Invitación registrada, pero el correo no se pudo enviar. La persona puede entrar con Google usando exactamente este correo; puedes reenviar la invitación más tarde.',
      emailSent: emailResult.emailSent,
      emailError: emailResult.emailError,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.roles.map((r: any) => r.role),
      },
    };
  }

  /**
   * Reenvía el correo de invitación. Solo para personal con estado INVITED
   * (el control de rol INSTITUTION_ADMIN está en el controlador).
   */
  async resendStaffInvitation(
    invitedUserId: string,
    actorId: string,
  ): Promise<InvitationEmailResult & { userId: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: invitedUserId },
      include: { roles: true },
    });
    if (!user || user.deletedAt || user.status === UserStatus.DELETED) {
      throw new NotFoundException('La persona indicada no existe.');
    }
    if (!user.roles.some((r) => r.role in STAFF_ROLE_LABEL)) {
      throw new BadRequestException(
        'Solo se reenvían invitaciones de profesores, administradores o analistas.',
      );
    }
    if (user.status !== UserStatus.INVITED) {
      throw new ConflictException(
        'Esta persona ya activó su cuenta; no hace falta reenviar la invitación.',
      );
    }
    const result = await this.sendStaffInvitationEmail(user.id, actorId, {
      resent: true,
    });
    return { ...result, userId: user.id, email: user.email };
  }

  /**
   * Arma y envía el correo de invitación (sin contraseñas, tokens ni enlaces mágicos):
   * quién invita, el rol en español, el correo exacto con el que debe entrar y un botón al login.
   * Nunca lanza: devuelve emailSent y audita STAFF_INVITATION_EMAIL_SENT / _FAILED sin el contenido.
   */
  async sendStaffInvitationEmail(
    invitedUserId: string,
    inviterUserId: string,
    opts: { role?: RoleType; resent?: boolean } = {},
  ): Promise<InvitationEmailResult> {
    const [invited, inviter] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: invitedUserId },
        include: { roles: true },
      }),
      this.prisma.user.findUnique({
        where: { id: inviterUserId },
        select: { name: true, lastNameP: true, lastNameM: true },
      }),
    ]);
    if (!invited) {
      return { emailSent: false, emailError: 'INVITED_USER_NOT_FOUND' };
    }

    const staffRoles = invited.roles
      .map((r) => r.role)
      .filter((r) => r in STAFF_ROLE_LABEL);
    const roles = opts.role ? [opts.role] : staffRoles;
    const roleText = roles.map((r) => STAFF_ROLE_LABEL[r] ?? r).join(' y ');
    const inviterName = inviter
      ? [inviter.name, inviter.lastNameP, inviter.lastNameM]
          .filter(Boolean)
          .join(' ')
      : 'La administración de PumaIA';
    const loginPath = roles.some(
      (r) => r === RoleType.INSTITUTION_ADMIN || r === RoleType.ANALYST,
    )
      ? '/admin'
      : '/profesores';
    const loginUrl = `${this.getFrontendBaseUrl()}${loginPath}`;
    const to = invited.email;

    const subject = 'Te invitaron a PumaIA';
    const text = [
      `Hola, ${invited.name}:`,
      '',
      `${inviterName} te invitó a PumaIA (FES Acatlán, UNAM) con el rol de ${roleText}.`,
      '',
      `Entra con tu cuenta de Google usando exactamente este correo: ${to}`,
      '',
      `Iniciar sesión: ${loginUrl}`,
      '',
      'No necesitas contraseña. Si no esperabas esta invitación, puedes ignorar este correo.',
      '',
      'Este correo se envía automáticamente; por favor no lo respondas. Si tienes dudas, comunícate con la coordinación por sus canales oficiales.',
      '',
      EMAIL_SENDER_NAME,
    ].join('\n');
    const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border-top:4px solid #C9A84C;">
<tr><td style="padding:28px 28px 8px;">
<h1 style="margin:0 0 12px;font-size:20px;color:#060D1F;">Te invitaron a PumaIA</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hola, ${escapeHtml(invited.name)}:</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;"><strong>${escapeHtml(inviterName)}</strong> te invitó a PumaIA (FES Acatlán, UNAM) con el rol de <strong>${escapeHtml(roleText)}</strong>.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Entra con tu cuenta de Google usando exactamente este correo: <strong>${escapeHtml(to)}</strong></p>
<p style="margin:0 0 24px;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#C9A84C;color:#060D1F;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;">Iniciar sesión con Google</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.5;">No necesitas contraseña. Si el botón no funciona, abre: ${escapeHtml(loginUrl)}</p>
<p style="margin:0 0 12px;font-size:13px;color:#555;line-height:1.5;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
<p style="margin:0 0 20px;font-size:12px;color:#777;line-height:1.5;">Este correo se envía automáticamente; por favor no lo respondas. Si tienes dudas, comunícate con la coordinación por sus canales oficiales.<br>${escapeHtml(EMAIL_SENDER_NAME)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

    let result: EmailDispatchResult;
    try {
      result = await this.dispatchInstitutionalEmail(to, subject, text, {
        category: 'STAFF_INVITATION',
        actionUrl: loginUrl,
        html,
        // La invitación se crea aunque el correo falle: nunca lanzar aquí.
        throwOnFailure: false,
      });
    } catch (err: any) {
      result = {
        delivered: false,
        channel: null,
        errorCode:
          err instanceof ServiceUnavailableException
            ? 'DELIVERY_REQUIRED_FAILED'
            : err?.code || 'EMAIL_DISPATCH_ERROR',
        httpStatus: null,
      };
    }

    // Bitácora sin el contenido del correo.
    await this.auditService.log({
      actorType: 'ADMIN',
      actorId: inviterUserId,
      action: result.delivered
        ? 'STAFF_INVITATION_EMAIL_SENT'
        : 'STAFF_INVITATION_EMAIL_FAILED',
      detail: {
        invitedUserId: invited.id,
        email: to,
        roles,
        channel: result.channel,
        httpStatus: result.httpStatus ?? null,
        errorCode: result.errorCode,
        resent: Boolean(opts.resent),
      },
    });
    if (!result.delivered) {
      this.logger.error(
        `[STAFF_INVITATION] Correo no enviado invitedUserId=${invited.id} code=${result.errorCode}`,
      );
    }

    return {
      emailSent: result.delivered,
      emailError: result.delivered ? null : result.errorCode,
    };
  }

  // =========================================================================
  // 5. GOOGLE OAUTH Y DEV-LOGIN INTEGRADOS AL MISMO SISTEMA DE SESIONES
  // =========================================================================

  async loginWithGoogle(
    dto: GoogleLoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    const googleProfile = await this.verifyGoogleIdToken(dto.idToken);
    return this.processGoogleProfile(googleProfile, dto.careerId, meta);
  }

  async devLogin(
    dto: DevLoginDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const isDevLoginEnabled =
      this.configService.get<string>('ENABLE_DEV_LOGIN') === 'true';

    const isLocalTestDb =
      this.configService.get<string>('PUMAIA_DB_TARGET') === 'local_test';

    if (isProduction || !isDevLoginEnabled || !isLocalTestDb) {
      throw new ForbiddenException(
        'El endpoint dev-login está estrictamente deshabilitado. Requiere ENABLE_DEV_LOGIN=true y PUMAIA_DB_TARGET=local_test.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    if (!this.hasStudentInstitutionalDomain(email)) {
      throw new BadRequestException(
        `El login de desarrollo solo admite cuentas institucionales con dominio exacto ${this.studentDomain}`,
      );
    }

    const mockGoogleProfile = {
      sub: `mock-google-sub-${email}`,
      email,
      name: dto.name,
      given_name: dto.name.split(' ')[0] || dto.name,
      family_name: dto.name.split(' ').slice(1).join(' ') || 'UNAM',
      picture: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      email_verified: true,
    };

    return this.processGoogleProfile(mockGoogleProfile, dto.careerId, meta);
  }

  public extractUserIdFromRequestTokens(
    refreshToken?: string | null,
    authHeader?: string | null,
  ): string | null {
    if (refreshToken) {
      try {
        const verified = this.jwtService.verify(refreshToken, {
          secret: this.getRefreshSecret(),
        });
        if (verified?.sub) return verified.sub;
      } catch {
        // firma inválida o expirada: no se confía en el contenido
      }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      if (accessToken) {
        try {
          const verified = this.jwtService.verify(accessToken, {
            secret: this.getAccessSecret(),
          });
          if (verified?.sub || verified?.userId)
            return verified.sub || verified.userId;
        } catch {
          // firma inválida o expirada: no se confía en el contenido
        }
      }
    }

    return null;
  }

  public extractSessionIdFromRequestTokens(
    refreshToken?: string | null,
    authHeader?: string | null,
  ): string | null {
    if (refreshToken) {
      try {
        const verified = this.jwtService.verify(refreshToken, {
          secret: this.getRefreshSecret(),
        });
        if (verified?.sid) return verified.sid;
      } catch {
        // firma inválida o expirada: no se confía en el contenido
      }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      if (accessToken) {
        try {
          const verified = this.jwtService.verify(accessToken, {
            secret: this.getAccessSecret(),
          });
          if (verified?.sid) return verified.sid;
        } catch {
          // firma inválida o expirada: no se confía en el contenido
        }
      }
    }

    return null;
  }

  private async processGoogleProfile(
    profile: {
      sub: string;
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email_verified?: boolean;
    },
    preferredCareerId?: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    const email = profile.email.toLowerCase().trim();
    const isStudentDomain = this.hasStudentInstitutionalDomain(email);

    if (isStudentDomain) {
      // Si tiene formato de cuenta estudiantil (1-9 dígitos) va a flujo de alumno;
      // si no es numérico pero ya fue invitado como staff, permitir flujo de staff.
      if (!this.isValidStudentInstitutionalEmail(email)) {
        const invitedStaff = await this.prisma.user.findUnique({
          where: { email },
          include: { roles: true },
        });
        const staffRoles: RoleType[] = [
          RoleType.PROFESSOR,
          RoleType.INSTITUTION_ADMIN,
          RoleType.ANALYST,
        ];
        if (
          invitedStaff &&
          invitedStaff.roles?.some((r) => staffRoles.includes(r.role))
        ) {
          return this.handleStaffLogin(profile, email, meta);
        }
      }
      return this.handleStudentLogin(profile, email, preferredCareerId, meta);
    } else {
      return this.handleStaffLogin(profile, email, meta);
    }
  }

  private async handleStudentLogin(
    profile: {
      sub: string;
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email_verified?: boolean;
    },
    email: string,
    preferredCareerId?: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    const isMock = profile.sub.startsWith('mock-google-sub-');
    const [localPart] = email.split('@');
    const accountRegex = /^\d{1,9}$/;

    if (!accountRegex.test(localPart) || parseInt(localPart, 10) <= 0) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'STUDENT_AUTH_REJECTED_INVALID_ACCOUNT',
        detail: { email, localPart },
      });
      throw new BadRequestException(
        `El correo institucional no contiene un número de cuenta válido (máximo 9 dígitos): ${localPart}`,
      );
    }

    const accountNumber = parseInt(localPart, 10);
    const parsedName = parseUnamAccountName(profile.name);

    let user: any = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleSub: profile.sub }],
      },
      include: {
        roles: true,
        student: true,
        professor: true,
      },
    });

    if (!user) {
      if (this.prisma.student?.findUnique) {
        const existingStudentByAccount = await this.prisma.student.findUnique({
          where: { accountNumber },
        });
        if (existingStudentByAccount) {
          throw new ConflictException(
            `El número de cuenta ${accountNumber} ya se encuentra vinculado a otro usuario registrado.`,
          );
        }
      }

      const institution = await this.getOrCreateDefaultInstitution();
      const careerId = await this.resolveCareerId(
        institution.id,
        preferredCareerId,
      );

      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            institutionId: institution.id,
            email,
            googleSub: isMock ? null : profile.sub,
            emailVerifiedAt: new Date(),
            // Formato de cuenta: "2024 Mat CASAS LORENZO SAUL" (gen, carrera, ap. P, ap. M, nombre).
            // Si no se interpreta con confianza queda provisional y el alumno lo confirma
            // (PATCH /students/profile-name); la tira de materias también lo sobrescribe.
            name: parsedName?.name ?? 'Alumno',
            lastNameP: parsedName?.lastNameP ?? String(accountNumber),
            lastNameM: parsedName?.lastNameM ?? null,
            avatarUrl: profile.picture || null,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
            roles: {
              create: {
                role: RoleType.STUDENT,
              },
            },
          },
        });

        await tx.student.create({
          data: {
            userId: newUser.id,
            accountNumber,
            careerId,
            currentSemester: 1,
            isGraduated: false,
            hasCompletedQuiz: false,
          },
        });

        return tx.user.findUnique({
          where: { id: newUser.id },
          include: { roles: true, student: true, professor: true },
        });
      });

      await this.auditService.log({
        actorType: 'STUDENT',
        actorId: user!.id,
        action: 'STUDENT_SELF_REGISTERED',
        detail: { email, accountNumber, careerId },
      });
    } else {
      if (user.status === UserStatus.DELETED || Boolean(user.deletedAt)) {
        throw new UnauthorizedException(
          'Esta cuenta ha sido dada de baja. Contacta a administración.',
        );
      }

      if (!isMock && user.googleSub && user.googleSub !== profile.sub) {
        await this.auditService.log({
          actorType: 'SYSTEM',
          actorId: user.id,
          action: 'GOOGLE_SUB_MISMATCH_BLOCKED',
          detail: { email },
        });
        throw new UnauthorizedException(
          'Conflicto de identidad: este correo institucional ya está vinculado a otra cuenta de Google.',
        );
      }

      if (user.email.trim().toLowerCase() !== email) {
        await this.auditService.log({
          actorType: 'SYSTEM',
          actorId: user.id,
          action: 'GOOGLE_EMAIL_MISMATCH_BLOCKED',
          detail: { email, registeredEmail: user.email },
        });
        throw new UnauthorizedException(
          'Conflicto de identidad: esta cuenta de Google ya está vinculada a otro correo institucional.',
        );
      }

      await this.assertInvitationEmailVerified(user, profile, isMock);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          googleSub: isMock ? user.googleSub : user.googleSub || profile.sub,
          ...(user.emailVerifiedAt || isMock
            ? {}
            : {
                // pre-hijacking: credenciales sembradas antes de probar el correo vía Google
                passwordHash: null,
                verificationTokenHash: null,
                verificationExpiresAt: null,
                resetPasswordTokenHash: null,
                resetPasswordExpiresAt: null,
              }),
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          status:
            user.status === UserStatus.INVITED
              ? UserStatus.ACTIVE
              : user.status,
          avatarUrl: profile.picture || user.avatarUrl,
        },
      });

      await this.auditInvitationAccepted(user, isMock);

      if (!user.student) {
        if (this.prisma.student?.findUnique) {
          const existingStudentByAccount = await this.prisma.student.findUnique(
            {
              where: { accountNumber },
            },
          );
          if (
            existingStudentByAccount &&
            existingStudentByAccount.userId !== user.id
          ) {
            throw new ConflictException(
              `El número de cuenta ${accountNumber} ya se encuentra vinculado a otro usuario.`,
            );
          }
        }

        const institution = await this.getOrCreateDefaultInstitution();
        const careerId = await this.resolveCareerId(
          institution.id,
          preferredCareerId,
        );

        const createdStudent = await this.prisma.student.create({
          data: {
            userId: user.id,
            accountNumber,
            careerId,
            currentSemester: 1,
          },
        });

        user.student = createdStudent;
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'No se pudo autenticar o inicializar la cuenta del usuario.',
      );
    }

    const roles: RoleType[] = (user.roles || []).map((r: any) => r.role);
    const tokens = await this.createSessionAndTokens(
      {
        userId: user.id,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`,
        roles,
        accountNumber: user.student?.accountNumber || accountNumber,
      },
      meta,
    );

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      detail: { email: user.email, roles, sessionId: tokens.sessionId },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`,
        avatarUrl: user.avatarUrl,
        roles,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        accountNumber: user.student?.accountNumber || accountNumber,
        hasCompletedQuiz: user.student?.hasCompletedQuiz ?? false,
        needsNameConfirmation: this.needsNameConfirmation(user),
      },
    };
  }

  private async handleStaffLogin(
    profile: {
      sub: string;
      email: string;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email_verified?: boolean;
    },
    email: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponse> {
    const user: any = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        student: true,
        professor: true,
      },
    });

    const isMock = profile.sub.startsWith('mock-google-sub-');

    if (!user) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'STAFF_LOGIN_REJECTED_UNREGISTERED',
        detail: { email },
      });
      throw new UnauthorizedException(
        'Acceso denegado. Las cuentas de profesor o administrador requieren invitación previa por parte de la institución. Para alumnos, inicia sesión con tu cuenta institucional @pcpuma.acatlan.unam.mx.',
      );
    }

    if (user.status === UserStatus.DELETED || Boolean(user.deletedAt)) {
      throw new UnauthorizedException(
        'Esta cuenta institucional se encuentra inactiva o dada de baja.',
      );
    }

    if (!isMock && user.googleSub && user.googleSub !== profile.sub) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user.id,
        action: 'STAFF_GOOGLE_SUB_MISMATCH_BLOCKED',
        detail: { email },
      });
      throw new UnauthorizedException(
        'Conflicto de identidad: esta cuenta institucional ya está vinculada a otro identificador de Google.',
      );
    }

    await this.assertInvitationEmailVerified(user, profile, isMock);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        googleSub: isMock ? user.googleSub : user.googleSub || profile.sub,
        ...(user.emailVerifiedAt || isMock
          ? {}
          : {
              // pre-hijacking: credenciales sembradas antes de probar el correo vía Google
              passwordHash: null,
              verificationTokenHash: null,
              verificationExpiresAt: null,
              resetPasswordTokenHash: null,
              resetPasswordExpiresAt: null,
            }),
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        status:
          user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
        avatarUrl: profile.picture || user.avatarUrl,
      },
    });

    await this.auditInvitationAccepted(user, isMock);

    const roles: RoleType[] = (user.roles || []).map((r: any) => r.role);
    const tokens = await this.createSessionAndTokens(
      {
        userId: user.id,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`,
        roles,
        accountNumber: user.student?.accountNumber || null,
      },
      meta,
    );

    await this.auditService.log({
      actorType: roles.includes(RoleType.INSTITUTION_ADMIN)
        ? 'ADMIN'
        : 'PROFESSOR',
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      detail: { email: user.email, roles, sessionId: tokens.sessionId },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`,
        avatarUrl: user.avatarUrl,
        roles,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        accountNumber: user.student?.accountNumber || null,
      },
    };
  }

  /**
   * Activar una invitación exige que Google confirme el correo (email_verified = true).
   * verifyGoogleIdToken ya lo rechaza antes; esto lo deja explícito por si cambia el flujo.
   */
  private async assertInvitationEmailVerified(
    user: { id: string; status: UserStatus; email: string },
    profile: { email_verified?: boolean },
    isMock: boolean,
  ) {
    if (user.status !== UserStatus.INVITED || isMock) return;
    if (profile.email_verified !== true) {
      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user.id,
        action: 'STAFF_INVITATION_REJECTED_UNVERIFIED_EMAIL',
        detail: { email: user.email },
      });
      throw new UnauthorizedException(
        'Google no confirmó este correo. No se puede activar la invitación.',
      );
    }
  }

  /** Si el usuario estaba INVITED, el login con Google lo activó: queda en la bitácora. */
  private async auditInvitationAccepted(
    user: {
      id: string;
      status: UserStatus;
      email: string;
      roles?: { role: RoleType }[];
    },
    isMock: boolean,
  ) {
    if (user.status !== UserStatus.INVITED) return;
    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: user.id,
      action: 'STAFF_INVITATION_ACCEPTED',
      detail: {
        email: user.email,
        roles: (user.roles ?? []).map((r) => r.role),
        viaMockGoogle: isMock,
      },
    });
  }

  // =========================================================================
  // 6. SESIONES MULTI-DISPOSITIVO, ROTACIÓN Y DETECCIÓN DE REÚSO DE REFRESH TOKEN
  // =========================================================================

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId?: string;
  }> {
    try {
      const refreshSecret = this.getRefreshSecret();
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException(
          'El token proporcionado no es un token válido de renovación.',
        );
      }

      const user: any = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: true, student: true, professor: true },
      });

      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        Boolean(user.deletedAt)
      ) {
        throw new UnauthorizedException('Usuario no válido o cuenta inactiva.');
      }

      const roles: RoleType[] = (user.roles || []).map((r: any) => r.role);
      if (roles.length === 0) {
        throw new UnauthorizedException('El usuario no posee roles activos.');
      }

      const incomingTokenHash = this.sha256(refreshToken);

      if (payload.sid) {
        if (this.inFlightRotations.has(payload.sid)) {
          await this.revokeSessionRecord(
            payload.sid,
            'CONCURRENT_REFRESH_TOKEN_REUSE',
          );
          await this.auditService.log({
            actorType: 'SYSTEM',
            actorId: user.id,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
            detail: {
              email: user.email,
              sessionId: payload.sid,
              concurrentAttempt: true,
            },
          });
          throw new UnauthorizedException(
            'Alerta de seguridad: se detectó intento concurrente de reutilización de un Refresh Token. La sesión ha sido invalidada.',
          );
        }

        this.inFlightRotations.add(payload.sid);
        try {
          const session = await this.findSessionById(payload.sid);

          if (!session) {
            throw new UnauthorizedException(
              'La sesión asociada al token no existe o ha expirado.',
            );
          }

          if (Boolean(session.revokedAt)) {
            await this.auditService.log({
              actorType: 'SYSTEM',
              actorId: user.id,
              action: 'REVOKED_REFRESH_TOKEN_ATTEMPT',
              detail: { email: user.email, sessionId: session.id },
            });
            throw new UnauthorizedException(
              'Esta sesión ha sido revocada o cerrada. Inicia sesión nuevamente.',
            );
          }

          if (new Date(session.expiresAt) <= new Date()) {
            throw new UnauthorizedException(
              'La sesión ha expirado. Inicia sesión nuevamente.',
            );
          }

          // Detección estricta de reúso de refresh token ya rotado
          if (session.refreshTokenHash !== incomingTokenHash) {
            await this.revokeSessionRecord(
              session.id,
              'REFRESH_TOKEN_REUSE_DETECTED',
            );
            await this.auditService.log({
              actorType: 'SYSTEM',
              actorId: user.id,
              action: 'REFRESH_TOKEN_REUSE_DETECTED',
              detail: {
                email: user.email,
                sessionId: session.id,
                familyId: session.familyId,
                matchedPrevious:
                  session.previousTokenHash === incomingTokenHash,
              },
            });
            throw new UnauthorizedException(
              'Alerta de seguridad: se detectó intento de reutilización de un Refresh Token ya rotado. La sesión ha sido invalidada.',
            );
          }

          // Rotar el token e invalidar inmediatamente el anterior guardándolo en previousTokenHash
          const rotatedTokens = this.signTokenPair(
            {
              userId: user.id,
              studentId: user.student?.id || null,
              professorId: user.professor?.id || null,
              email: user.email,
              name: `${user.name} ${user.lastNameP}`,
              roles,
              accountNumber: user.student?.accountNumber || null,
            },
            session.id,
            session.familyId,
          );

          const newTokenHash = this.sha256(rotatedTokens.refreshToken);
          const rotatedAtomically = await this.rotateSessionRecord(
            session.id,
            newTokenHash,
            incomingTokenHash,
          );

          if (!rotatedAtomically) {
            await this.revokeSessionRecord(
              session.id,
              'REFRESH_TOKEN_REUSE_DETECTED',
            );
            await this.auditService.log({
              actorType: 'SYSTEM',
              actorId: user.id,
              action: 'REFRESH_TOKEN_REUSE_DETECTED',
              detail: {
                email: user.email,
                sessionId: session.id,
                familyId: session.familyId,
                atomicCasFailed: true,
              },
            });
            throw new UnauthorizedException(
              'Alerta de seguridad: el Refresh Token ya fue rotado por otra solicitud simultánea. La sesión ha sido invalidada.',
            );
          }

          await this.auditService.log({
            actorType: 'SYSTEM',
            actorId: user.id,
            action: 'TOKEN_REFRESH_SUCCESS',
            detail: { email: user.email, sessionId: session.id },
          });

          return {
            ...rotatedTokens,
            sessionId: session.id,
          };
        } finally {
          this.inFlightRotations.delete(payload.sid);
        }
      }

      // Compatibilidad con tokens sin sid (p. ej. mocks de pruebas unitarias legacy)
      if (user.lastLoginAt && payload.issuedAtMs) {
        if (payload.issuedAtMs < user.lastLoginAt.getTime() - 2000) {
          await this.auditService.log({
            actorType: 'SYSTEM',
            actorId: user.id,
            action: 'REVOKED_REFRESH_TOKEN_ATTEMPT',
            detail: { email: user.email },
          });
          throw new UnauthorizedException(
            'Esta sesión ha sido revocada o cerrada. Inicia sesión nuevamente.',
          );
        }
      }

      const newTokens = await this.createSessionAndTokens({
        userId: user.id,
        studentId: user.student?.id || null,
        professorId: user.professor?.id || null,
        email: user.email,
        name: `${user.name} ${user.lastNameP}`,
        roles,
        accountNumber: user.student?.accountNumber || null,
      });

      await this.auditService.log({
        actorType: 'SYSTEM',
        actorId: user.id,
        action: 'TOKEN_REFRESH_SUCCESS',
        detail: { email: user.email },
      });

      return newTokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Refresh token expirado, revocado o inválido.',
      );
    }
  }

  async getMe(userId: string) {
    const user: any = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        personalProfile: true,
        student: {
          include: {
            career: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        professor: {
          include: {
            academicCategory: true,
          },
        },
      },
    });

    if (
      !user ||
      user.status === UserStatus.DELETED ||
      Boolean(user.deletedAt)
    ) {
      throw new UnauthorizedException(
        'Usuario no encontrado o cuenta inactiva.',
      );
    }

    const accountNumber = user.student?.accountNumber ?? null;
    const accountNumberFormatted =
      accountNumber !== null ? String(accountNumber).padStart(9, '0') : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastNameP: user.lastNameP,
      lastNameM: user.lastNameM,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      needsNameConfirmation: this.needsNameConfirmation(user),
      roles: user.roles.map((r: any) => r.role),
      personalProfile: user.personalProfile,
      student: user.student
        ? {
            id: user.student.id,
            accountNumber,
            accountNumberFormatted,
            career: user.student.career,
            currentSemester: user.student.currentSemester,
            average: user.student.average,
            isGraduated: user.student.isGraduated,
            hasCompletedQuiz: user.student.hasCompletedQuiz,
            interest: user.student.interest,
          }
        : null,
      professor: user.professor || null,
    };
  }

  /**
   * Cierra únicamente la sesión actual (o todas las sesiones del usuario si no se especifica sessionId),
   * sin contaminar el campo lastLoginAt ni cerrar sesiones legítimas en otros dispositivos.
   */
  async logout(
    userId: string,
    sessionId?: string | null,
    refreshToken?: string | null,
  ): Promise<{ message: string }> {
    const resolvedSessionId =
      sessionId || this.extractSessionIdFromRequestTokens(refreshToken, null);

    if (resolvedSessionId) {
      await this.revokeSessionRecord(resolvedSessionId, 'USER_LOGOUT');
    } else if (refreshToken) {
      const hash = this.sha256(refreshToken);
      for (const [id, sess] of this.sessionMirror.entries()) {
        if (sess.userId === userId && sess.refreshTokenHash === hash) {
          await this.revokeSessionRecord(id, 'USER_LOGOUT');
        }
      }
      if ((this.prisma as any).authSession?.updateMany) {
        try {
          await (this.prisma as any).authSession.updateMany({
            where: { userId, refreshTokenHash: hash, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: 'USER_LOGOUT' },
          });
        } catch {
          // Fallback silencioso si el cliente está en modo mock
        }
      }
    } else {
      await this.revokeAllUserSessions(userId, 'USER_LOGOUT');
    }

    await this.auditService.log({
      actorType: 'SYSTEM',
      actorId: userId,
      action: 'LOGOUT',
      detail: { sessionId: resolvedSessionId || null },
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  private async createSessionAndTokens(
    user: {
      userId: string;
      studentId: string | null;
      professorId?: string | null;
      email: string;
      name: string;
      roles: RoleType[];
      accountNumber: number | null;
    },
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const sessionId = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const tokens = this.signTokenPair(user, sessionId, familyId);
    const refreshTokenHash = this.sha256(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    this.sessionMirror.set(sessionId, {
      id: sessionId,
      userId: user.userId,
      refreshTokenHash,
      previousTokenHash: null,
      familyId,
      expiresAt,
      revokedAt: null,
      revokedReason: null,
    });

    if ((this.prisma as any).authSession?.create) {
      try {
        await (this.prisma as any).authSession.create({
          data: {
            id: sessionId,
            userId: user.userId,
            refreshTokenHash,
            previousTokenHash: null,
            familyId,
            userAgent: meta?.userAgent || null,
            ipAddress: meta?.ipAddress || null,
            expiresAt,
            revokedAt: null,
            revokedReason: null,
          },
        });
      } catch {
        // En entornos con Prisma mock parcial o sin tabla migrada aún, sessionMirror mantiene la seguridad
      }
    }

    return {
      ...tokens,
      sessionId,
    };
  }

  private signTokenPair(
    user: {
      userId: string;
      studentId: string | null;
      professorId?: string | null;
      email: string;
      name: string;
      roles: RoleType[];
      accountNumber: number | null;
    },
    sessionId: string,
    familyId: string,
  ) {
    const accessPayload: JwtPayload & { tokenType: string } = {
      sub: user.userId,
      userId: user.userId,
      studentId: user.studentId,
      professorId: user.professorId ?? null,
      sid: sessionId,
      email: user.email,
      name: user.name,
      roles: user.roles,
      accountNumber: user.accountNumber,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: '15m',
      secret: this.getAccessSecret(),
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: user.userId,
        sid: sessionId,
        familyId,
        jti: crypto.randomUUID(),
        tokenType: 'refresh',
        issuedAtMs: Date.now(),
      },
      {
        expiresIn: '7d',
        secret: this.getRefreshSecret(),
      },
    );

    return { accessToken, refreshToken };
  }

  private async findSessionById(
    sessionId: string,
  ): Promise<SessionMirror | null> {
    if ((this.prisma as any).authSession?.findUnique) {
      try {
        const dbSession = await (this.prisma as any).authSession.findUnique({
          where: { id: sessionId },
        });
        if (dbSession) {
          this.sessionMirror.set(sessionId, dbSession);
          return dbSession;
        }
      } catch {
        // Fallback a memoria
      }
    }
    return this.sessionMirror.get(sessionId) || null;
  }

  private async rotateSessionRecord(
    sessionId: string,
    newRefreshTokenHash: string,
    previousTokenHash: string,
  ): Promise<boolean> {
    const mirror = this.sessionMirror.get(sessionId);
    if (mirror) {
      if (
        mirror.refreshTokenHash !== previousTokenHash ||
        Boolean(mirror.revokedAt)
      ) {
        return false;
      }
      mirror.previousTokenHash = previousTokenHash;
      mirror.refreshTokenHash = newRefreshTokenHash;
    }

    if ((this.prisma as any).authSession?.updateMany) {
      try {
        const res = await (this.prisma as any).authSession.updateMany({
          where: {
            id: sessionId,
            refreshTokenHash: previousTokenHash,
            revokedAt: null,
          },
          data: {
            previousTokenHash,
            refreshTokenHash: newRefreshTokenHash,
            rotatedAt: new Date(),
          },
        });
        if (res && typeof res.count === 'number' && res.count === 0) {
          return false;
        }
        return true;
      } catch {
        // Fallback a update si updateMany no está implementado en un mock simple
      }
    }

    if ((this.prisma as any).authSession?.update) {
      try {
        await (this.prisma as any).authSession.update({
          where: { id: sessionId },
          data: {
            previousTokenHash,
            refreshTokenHash: newRefreshTokenHash,
            rotatedAt: new Date(),
          },
        });
      } catch {
        // Fallback a mirror
      }
    }

    return true;
  }

  private async revokeSessionRecord(
    sessionId: string,
    reason: string,
  ): Promise<void> {
    const mirror = this.sessionMirror.get(sessionId);
    if (mirror) {
      mirror.revokedAt = new Date();
      mirror.revokedReason = reason;
    }

    if ((this.prisma as any).authSession?.update) {
      try {
        await (this.prisma as any).authSession.update({
          where: { id: sessionId },
          data: {
            revokedAt: new Date(),
            revokedReason: reason,
          },
        });
      } catch {
        // Fallback a mirror
      }
    }
  }

  private async revokeAllUserSessions(
    userId: string,
    reason: string,
  ): Promise<void> {
    for (const sess of this.sessionMirror.values()) {
      if (sess.userId === userId && sess.revokedAt === null) {
        sess.revokedAt = new Date();
        sess.revokedReason = reason;
      }
    }

    if ((this.prisma as any).authSession?.updateMany) {
      try {
        await (this.prisma as any).authSession.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revokedReason: reason,
          },
        });
      } catch {
        // Fallback a mirror
      }
    }
  }

  private async verifyGoogleIdToken(idToken: string) {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException(
          'El token de Google no pudo ser verificado con el proveedor.',
        );
      }

      const payload = await response.json();

      if (payload.error_description || payload.error) {
        throw new UnauthorizedException(
          `Token de Google inválido: ${payload.error_description || payload.error}`,
        );
      }

      const validIssuers = [
        'accounts.google.com',
        'https://accounts.google.com',
      ];
      if (!payload.iss || !validIssuers.includes(payload.iss)) {
        throw new UnauthorizedException(
          'El emisor (iss) del token de Google no es válido.',
        );
      }

      const rawAud =
        this.configService.get<string>('GOOGLE_CLIENT_ID') ||
        this.configService.get<string>('NEXT_PUBLIC_GOOGLE_CLIENT_ID') ||
        process.env.GOOGLE_CLIENT_ID ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const configuredAud = rawAud?.replace(/^["']|["']$/g, '').trim();

      if (!configuredAud) {
        this.logger.error(
          'GOOGLE_CLIENT_ID no está configurado en las variables de entorno.',
        );
        throw new UnauthorizedException(
          'La autenticación con Google no está disponible: falta configurar GOOGLE_CLIENT_ID en el servidor.',
        );
      }

      const audMatches =
        payload.aud === configuredAud ||
        payload.azp === configuredAud ||
        (Array.isArray(payload.aud) && payload.aud.includes(configuredAud));

      if (!audMatches) {
        this.logger.error(
          `Audiencia de Google no coincide: recibida=${payload.aud}, azp=${payload.azp}, esperada=${configuredAud}`,
        );
        throw new UnauthorizedException(
          'La audiencia (aud) del token de Google no coincide con el cliente de PumaIA.',
        );
      }

      if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) {
        throw new UnauthorizedException(
          'El token de Google ha expirado o no contiene fecha de expiración.',
        );
      }

      if (
        payload.email_verified !== 'true' &&
        payload.email_verified !== true
      ) {
        throw new UnauthorizedException(
          'El correo de Google no se encuentra verificado.',
        );
      }

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException(
          'El token de Google no contiene identificador sub o correo electrónico.',
        );
      }

      return {
        sub: String(payload.sub),
        email: String(payload.email).trim().toLowerCase(),
        name:
          payload.name ||
          `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        email_verified: true,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Error verificando token de Google: ${error?.message}`);
      throw new UnauthorizedException(
        'Error de comunicación con el servicio de autenticación de Google.',
      );
    }
  }

  private getAccessSecret(): string {
    const configured = this.configService.get<string>('JWT_SECRET');
    if (configured) return configured;
    const env = this.configService.get<string>('NODE_ENV');
    if (env !== 'development' && env !== 'test') {
      throw new InternalServerErrorException('JWT_SECRET no está configurado.');
    }
    return 'pumaia-dev-only-secret';
  }

  private getRefreshSecret(): string {
    const configured = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (configured) return configured;

    const env = this.configService.get<string>('NODE_ENV');
    if (env !== 'development' && env !== 'test') {
      throw new InternalServerErrorException(
        'JWT_REFRESH_SECRET no está configurado.',
      );
    }
    return `${this.getAccessSecret()}_dev_refresh`;
  }

  private async getOrCreateDefaultInstitution() {
    let institution = await this.prisma.institution.findFirst({
      where: { code: '240' },
    });

    if (!institution) {
      institution = await this.prisma.institution.findFirst();
    }

    if (!institution) {
      institution = await this.prisma.institution.create({
        data: {
          name: 'Facultad de Estudios Superiores Acatlán',
          code: '240',
        },
      });
    }

    return institution;
  }

  private async resolveCareerId(
    institutionId: string,
    preferredCareerId?: string,
  ): Promise<string> {
    if (preferredCareerId) {
      const career = await this.prisma.career.findUnique({
        where: { id: preferredCareerId },
      });
      if (career) return career.id;
    }

    const firstCareer = await this.prisma.career.findFirst({
      where: { institutionId },
    });

    if (firstCareer) return firstCareer.id;

    const anyCareer = await this.prisma.career.findFirst();
    if (anyCareer) return anyCareer.id;

    throw new BadRequestException(
      'No se encontró ningún catálogo de carreras registrado en el sistema para asociar al alumno.',
    );
  }

  private getFrontendBaseUrl(): string {
    const raw =
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      'http://localhost:3000';
    return raw.trim().replace(/\/+$/, '');
  }

  public buildFrontendAuthLink(
    mode: 'verify' | 'reset',
    email: string,
    token: string,
  ): string {
    const baseUrl = this.getFrontendBaseUrl();
    const params = new URLSearchParams({
      mode,
      email: email.trim().toLowerCase(),
      token,
    });
    return `${baseUrl}/?${params.toString()}`;
  }

  /**
   * Permite en entornos de prueba (NODE_ENV !== 'production') inspeccionar la bandeja de salida
   * de correos enviados sin exponer tokens en respuestas HTTP ni en bitácoras de consola.
   */
  public getLatestTestEmail(email: string) {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return null;
    }
    return this.testEmailOutbox.get(email.trim().toLowerCase()) || null;
  }

  /**
   * Envía un correo por el webhook de n8n (N8N_EMAIL_WEBHOOK_URL + N8N_EMAIL_WEBHOOK_API_KEY).
   * En desarrollo, y solo si no hay webhook, puede usar el SMTP de pruebas (SMTP_HOST).
   * Devuelve si se entregó. Si la entrega es obligatoria (producción o EMAIL_REQUIRE_DELIVERY=true)
   * y falla, lanza ServiceUnavailableException, salvo que se pase throwOnFailure: false.
   */
  private async dispatchInstitutionalEmail(
    to: string,
    subject: string,
    text: string,
    meta: {
      category: 'VERIFICATION' | 'PASSWORD_RESET' | 'STAFF_INVITATION';
      actionUrl: string;
      token?: string | null;
      expiresAt?: Date | null;
      /** Versión HTML opcional (se envía junto con el texto plano). */
      html?: string;
      /** false = nunca lanza; el llamador decide con el resultado (invitaciones). */
      throwOnFailure?: boolean;
    },
  ): Promise<EmailDispatchResult> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const requireDelivery =
      isProd ||
      this.configService.get<string>('EMAIL_REQUIRE_DELIVERY') === 'true';
    const normalizedTo = to.trim().toLowerCase();
    const fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      'no-reply@pcpuma.acatlan.unam.mx';

    if (!isProd) {
      const entry = {
        to: normalizedTo,
        subject,
        text,
        actionUrl: meta.actionUrl,
        token: meta.token ?? null,
        category: meta.category,
        expiresAt: meta.expiresAt ?? null,
        sentAt: new Date(),
      };
      this.testEmailOutbox.set(normalizedTo, entry);

      const outboxPath = this.configService.get<string>(
        'EMAIL_TEST_OUTBOX_PATH',
      );
      if (outboxPath) {
        try {
          const resolvedPath = path.isAbsolute(outboxPath)
            ? outboxPath
            : path.join(process.cwd(), outboxPath);
          fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
          let current: Record<string, any> = {};
          if (fs.existsSync(resolvedPath)) {
            try {
              current = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
            } catch {
              current = {};
            }
          }
          current[normalizedTo] = {
            to: entry.to,
            subject: entry.subject,
            actionUrl: entry.actionUrl,
            token: entry.token,
            category: entry.category,
            expiresAt: entry.expiresAt ? entry.expiresAt.toISOString() : null,
            sentAt: entry.sentAt.toISOString(),
          };
          fs.writeFileSync(resolvedPath, JSON.stringify(current, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
          });
        } catch {
          // Ignorar errores de escritura en archivo temporal de pruebas
        }
      }
    }

    const webhookUrl = this.configService
      .get<string>('N8N_EMAIL_WEBHOOK_URL')
      ?.trim();
    const webhookApiKey = this.configService
      .get<string>('N8N_EMAIL_WEBHOOK_API_KEY')
      ?.trim();
    const smtpHost = this.configService.get<string>('SMTP_HOST');

    let lastSafeErrorCode = 'NO_PROVIDER_CONFIGURED';
    let lastHttpStatus: number | null = null;

    // 1) Canal principal (y único en producción): webhook de n8n, que envía con Gmail.
    //    Exige URL y clave; si falta alguna se considera "sin proveedor configurado".
    if (webhookUrl && webhookApiKey) {
      const res = await this.sendViaN8nWebhook({
        url: webhookUrl,
        apiKey: webhookApiKey,
        to: normalizedTo,
        subject,
        text,
        html: meta.html,
        category: meta.category,
      });
      if (res.delivered) return res;
      lastSafeErrorCode = res.errorCode ?? 'WEBHOOK_DELIVERY_ERROR';
      lastHttpStatus = res.httpStatus ?? null;
    } else if (webhookUrl || webhookApiKey) {
      // Solo nombres de variables en el log, nunca valores.
      this.logger.warn(
        `[EMAIL_DISPATCH] category=${meta.category} status=SKIPPED channel=WEBHOOK reason=MISSING_${webhookUrl ? 'N8N_EMAIL_WEBHOOK_API_KEY' : 'N8N_EMAIL_WEBHOOK_URL'}`,
      );
    }

    // 2) SMTP hecho a mano (sin TLS ni autenticación): solo en desarrollo y solo si no hay
    //    webhook configurado (p. ej. MailHog en pruebas). En producción está desactivado.
    else if (smtpHost && !isProd) {
      try {
        await this.sendViaSmtp({
          host: smtpHost,
          port: Number(this.configService.get<string>('SMTP_PORT') || 1025),
          from: fromAddress,
          to: normalizedTo,
          subject,
          text,
          html: meta.html,
        });
        this.logger.log(
          `[EMAIL_DISPATCH] category=${meta.category} status=DELIVERED channel=SMTP`,
        );
        return {
          delivered: true,
          channel: 'SMTP',
          errorCode: null,
          httpStatus: null,
        };
      } catch (err: any) {
        lastSafeErrorCode = err?.code || 'SMTP_DELIVERY_ERROR';
        this.logger.warn(
          `[EMAIL_DISPATCH] category=${meta.category} status=FAILED channel=SMTP code=${lastSafeErrorCode}`,
        );
      }
    }

    if (requireDelivery && meta.throwOnFailure !== false) {
      this.logger.error(
        `[EMAIL_DISPATCH] category=${meta.category} status=ABORTED reason=${lastSafeErrorCode}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de correo institucional no se encuentra disponible temporalmente. Por favor intenta más tarde.',
      );
    }

    if (!isProd) {
      // Registro sanitizado en desarrollo/pruebas: NUNCA imprime el token ni el enlace secreto en logs
      this.logger.log(
        `[EMAIL_DISPATCH] category=${meta.category} status=QUEUED_SANDBOX reason=${lastSafeErrorCode}`,
      );
    }
    return {
      delivered: false,
      channel: null,
      errorCode: lastSafeErrorCode,
      httpStatus: lastHttpStatus,
    };
  }

  /**
   * POST al webhook de n8n con {from, to, subject, text, html} y la cabecera X-Email-Api-Key.
   * Enviado = SOLO si n8n responde 2xx (n8n responde 200 únicamente cuando Gmail confirmó).
   * Cualquier otra respuesta, error de red o timeout (10 s) = no enviado, con código seguro.
   * Nunca registra la clave, la URL ni el contenido del correo.
   */
  private async sendViaN8nWebhook(params: {
    url: string;
    apiKey: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    category: string;
  }): Promise<EmailDispatchResult> {
    try {
      const response = await fetch(params.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Email-Api-Key': params.apiKey,
        },
        body: JSON.stringify({
          // n8n envía desde la cuenta de Gmail conectada; esto es solo el nombre visible.
          from: EMAIL_SENDER_NAME,
          to: params.to,
          subject: params.subject,
          text: params.text,
          ...(params.html ? { html: params.html } : {}),
        }),
        signal: AbortSignal.timeout(N8N_EMAIL_TIMEOUT_MS),
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(
          `[EMAIL_DISPATCH] category=${params.category} status=DELIVERED channel=WEBHOOK http=${response.status}`,
        );
        return {
          delivered: true,
          channel: 'WEBHOOK',
          errorCode: null,
          httpStatus: response.status,
        };
      }

      const errorCode = `WEBHOOK_HTTP_${response.status}`;
      this.logger.error(
        `[EMAIL_DISPATCH] category=${params.category} status=FAILED channel=WEBHOOK code=${errorCode}`,
      );
      return {
        delivered: false,
        channel: 'WEBHOOK',
        errorCode,
        httpStatus: response.status,
      };
    } catch (err: any) {
      const isTimeout =
        err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const errorCode = isTimeout ? 'WEBHOOK_TIMEOUT' : 'WEBHOOK_NETWORK_ERROR';
      this.logger.error(
        `[EMAIL_DISPATCH] category=${params.category} status=FAILED channel=WEBHOOK code=${errorCode}`,
      );
      return {
        delivered: false,
        channel: 'WEBHOOK',
        errorCode,
        httpStatus: null,
      };
    }
  }

  private sendViaSmtp(params: {
    host: string;
    port: number;
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const normalizeBody = (body: string) =>
      body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const bodyLines: string[] = params.html
      ? (() => {
          const boundary = `pumaia-${crypto.randomBytes(12).toString('hex')}`;
          return [
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            normalizeBody(params.text),
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            normalizeBody(params.html),
            `--${boundary}--`,
          ];
        })()
      : [
          'Content-Type: text/plain; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          normalizeBody(params.text),
        ];
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: params.host, port: params.port },
        () => {},
      );
      socket.setTimeout(5000);

      let step = 0;
      let buffer = '';

      const sendCommand = (cmd: string) => {
        socket.write(`${cmd}\r\n`);
      };

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line || line.length < 3) continue;
          const code = parseInt(line.slice(0, 3), 10);
          // Esperar línea final si es respuesta multilínea (ej. 250-...)
          if (line[3] === '-') continue;

          if (code >= 400) {
            socket.destroy();
            return reject(
              Object.assign(new Error('SMTP_REJECTED'), {
                code: `SMTP_${code}`,
              }),
            );
          }

          if (step === 0 && code === 220) {
            step = 1;
            sendCommand('EHLO pumaia.acatlan.unam.mx');
          } else if (step === 1 && code === 250) {
            step = 2;
            sendCommand(`MAIL FROM:<${params.from}>`);
          } else if (step === 2 && code === 250) {
            step = 3;
            sendCommand(`RCPT TO:<${params.to}>`);
          } else if (step === 3 && code === 250) {
            step = 4;
            sendCommand('DATA');
          } else if (step === 4 && code === 354) {
            step = 5;
            const safeSubject = `=?UTF-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;
            const mimeMessage = [
              `From: PUMAIA FES Acatlan <${params.from}>`,
              `To: <${params.to}>`,
              `Subject: ${safeSubject}`,
              'MIME-Version: 1.0',
              ...bodyLines,
              '.',
            ].join('\r\n');
            sendCommand(mimeMessage);
          } else if (step === 5 && code === 250) {
            step = 6;
            sendCommand('QUIT');
            socket.end();
            return resolve();
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(
          Object.assign(new Error('SMTP_TIMEOUT'), { code: 'SMTP_TIMEOUT' }),
        );
      });

      socket.on('error', (err: any) => {
        socket.destroy();
        reject(
          Object.assign(new Error('SMTP_SOCKET_ERROR'), {
            code: err?.code || 'SMTP_SOCKET_ERROR',
          }),
        );
      });
    });
  }
}
