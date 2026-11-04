import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AutenticacionService } from './autenticacion.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { JwtStrategy } from './jwt.strategy';
import { RoleType, UserStatus, ConsentKind } from '@prisma/client';
import { ConsentsService } from '../consents/consents.service';

describe('Pruebas de Seguridad y Validación — Fase 1 PumaIA', () => {
  let authService: AutenticacionService;
  let jwtStrategy: JwtStrategy;
  let consentsService: ConsentsService;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockJwtService: any;
  let mockAuditService: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      student: {
        create: jest.fn(),
      },
      institution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inst-1', code: '240' }),
      },
      career: {
        findFirst: jest.fn().mockResolvedValue({ id: 'career-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'career-1' }),
      },
      privacyNotice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      consentRecord: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'pumaia-google-client-id.apps.googleusercontent.com';
        if (key === 'JWT_SECRET') return 'test-access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ENABLE_DEV_LOGIN') return 'true';
        return null;
      }),
    };

    mockJwtService = {
      sign: jest.fn((payload) => `signed-${payload.tokenType || 'token'}`),
      verify: jest.fn(),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutenticacionService,
        JwtStrategy,
        ConsentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    authService = module.get<AutenticacionService>(AutenticacionService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    consentsService = module.get<ConsentsService>(ConsentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // CASO 1: Token de Google con audiencia incorrecta
  it('1. Token de Google con audiencia incorrecta debe ser rechazado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'otra-app-ajena.apps.googleusercontent.com', // Audiencia ajena
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: 'true',
        email: '318291029@pcpuma.acatlan.unam.mx',
        sub: 'google-sub-1',
      }),
    } as any);

    await expect(authService.loginWithGoogle({ idToken: 'token-con-aud-ajena' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 2: GOOGLE_CLIENT_ID ausente en variables de entorno
  it('2. GOOGLE_CLIENT_ID ausente debe rechazar la autenticación de forma segura', async () => {
    mockConfigService.get = jest.fn((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return undefined; // Ausente
      return 'test-secret';
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'algun-client-id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: 'true',
        email: '318291029@pcpuma.acatlan.unam.mx',
        sub: 'google-sub-1',
      }),
    } as any);

    await expect(authService.loginWithGoogle({ idToken: 'token-cualquiera' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 3: Token de Google expirado
  it('3. Token de Google expirado debe ser rechazado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'pumaia-google-client-id.apps.googleusercontent.com',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expirado hace 1 hora
        email_verified: 'true',
        email: '318291029@pcpuma.acatlan.unam.mx',
        sub: 'google-sub-1',
      }),
    } as any);

    await expect(authService.loginWithGoogle({ idToken: 'token-expirado' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 4: Correo no verificado en Google
  it('4. Correo no verificado por Google debe ser rechazado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'pumaia-google-client-id.apps.googleusercontent.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: 'false', // No verificado
        email: '318291029@pcpuma.acatlan.unam.mx',
        sub: 'google-sub-1',
      }),
    } as any);

    await expect(authService.loginWithGoogle({ idToken: 'token-unverified' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 5: Correo de dominio diferente (no alumno) sin registro previo
  it('5. Correo de dominio diferente al de alumnos debe ser rechazado si no tiene invitación previa', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'pumaia-google-client-id.apps.googleusercontent.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: 'true',
        email: 'profesor.desconocido@acatlan.unam.mx', // No @pcpuma
        sub: 'google-sub-prof',
      }),
    } as any);

    mockPrisma.user.findUnique.mockResolvedValue(null); // No existe en BD

    await expect(authService.loginWithGoogle({ idToken: 'token-profesor-no-invitado' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 6: Refresh token utilizado como access token
  it('6. Refresh token utilizado en JwtStrategy como access token debe ser rechazado', async () => {
    const refreshPayload = {
      sub: 'user-uuid',
      userId: 'user-uuid',
      tokenType: 'refresh', // Es un refresh token
      roles: [RoleType.STUDENT],
      email: '318291029@pcpuma.acatlan.unam.mx',
    };

    await expect(jwtStrategy.validate(refreshPayload as any)).rejects.toThrow(UnauthorizedException);
  });

  // CASO 7: Access token utilizado como refresh token
  it('7. Access token utilizado en refreshAccessToken debe ser rechazado', async () => {
    mockJwtService.verify.mockReturnValue({
      sub: 'user-uuid',
      tokenType: 'access', // Intentando renovar con un Access Token
      issuedAtMs: Date.now(),
    });

    await expect(authService.refreshAccessToken('fake-access-token')).rejects.toThrow(UnauthorizedException);
  });

  // CASO 8: Refresh token emitido antes del logout
  it('8. Refresh token anterior al logout debe ser rechazado por revocación', async () => {
    const logoutDate = new Date('2026-11-02T12:00:00Z');
    const tokenIssuedAtMs = new Date('2026-11-02T11:00:00Z').getTime(); // 1 hora antes del logout

    mockJwtService.verify.mockReturnValue({
      sub: 'user-uuid',
      tokenType: 'refresh',
      issuedAtMs: tokenIssuedAtMs,
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-uuid',
      status: UserStatus.ACTIVE,
      lastLoginAt: logoutDate, // Registra el logout posterior
      roles: [{ role: RoleType.STUDENT }],
      student: { id: 'student-uuid', accountNumber: 318291029 },
    });

    await expect(authService.refreshAccessToken('refresh-token-anterior-a-logout')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 9: Consentimientos en lote: falla atómica en $transaction
  it('9. Consentimientos en lote debe fallar atómicamente si un elemento es inválido', async () => {
    mockPrisma.privacyNotice.findUnique
      .mockResolvedValueOnce({ id: 'notice-1', kind: ConsentKind.TERMS_AND_NOTICE })
      .mockResolvedValueOnce(null); // Segundo aviso no existe

    const consentsPayload = [
      { kind: ConsentKind.TERMS_AND_NOTICE, noticeId: 'notice-1', granted: true },
      { kind: ConsentKind.ANALYTICS, noticeId: 'notice-inexistente', granted: true },
    ];

    await expect(consentsService.recordBatchConsents('user-1', consentsPayload)).rejects.toThrow();
  });

  // CASO 10: Protección contra colisión/suplantación de googleSub sobre cuenta existente
  it('10. Conflicto de identidad: correo existente vinculado a otro googleSub debe ser rechazado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iss: 'https://accounts.google.com',
        aud: 'pumaia-google-client-id.apps.googleusercontent.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: 'true',
        email: '318291029@pcpuma.acatlan.unam.mx',
        sub: 'google-sub-atacante',
      }),
    } as any);

    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-legitimo',
      email: '318291029@pcpuma.acatlan.unam.mx',
      googleSub: 'google-sub-original',
      status: UserStatus.ACTIVE,
      roles: [{ role: RoleType.STUDENT }],
      student: { id: 'student-1', accountNumber: 318291029 },
    });

    await expect(authService.loginWithGoogle({ idToken: 'token-colision-sub' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // CASO 11: Validación estricta del dominio institucional @pcpuma.acatlan.unam.mx
  it('11. isValidStudentInstitutionalEmail debe aceptar solo @pcpuma.acatlan.unam.mx exacto', () => {
    expect(authService.isValidStudentInstitutionalEmail('318291029@pcpuma.acatlan.unam.mx')).toBe(true);
    expect(authService.isValidStudentInstitutionalEmail('  318291029@PCPUMA.ACATLAN.UNAM.MX  ')).toBe(true);
    expect(authService.isValidStudentInstitutionalEmail('318291029@gmail.com')).toBe(false);
    expect(authService.isValidStudentInstitutionalEmail('318291029@acatlan.unam.mx')).toBe(false);
    expect(authService.isValidStudentInstitutionalEmail('318291029@sub.pcpuma.acatlan.unam.mx')).toBe(false);
    expect(authService.isValidStudentInstitutionalEmail('a@b@pcpuma.acatlan.unam.mx')).toBe(false);
    expect(authService.isValidStudentInstitutionalEmail('@pcpuma.acatlan.unam.mx')).toBe(false);
  });
});

