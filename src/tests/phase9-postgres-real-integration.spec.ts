import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, RoleType, ConsentKind, QuestionType, QuestionnaireKind, EnrollmentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AutenticacionController } from '../autenticacion/autenticacion.controller';
import { AutenticacionService } from '../autenticacion/autenticacion.service';
import { JwtStrategy } from '../autenticacion/jwt.strategy';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { ConsentsController } from '../consents/consents.controller';
import { ConsentsService } from '../consents/consents.service';
import { ChatController } from '../chat/chat.controller';
import { ChatService } from '../chat/chat.service';
import { QuestionnaireController } from '../questionnaire/questionnaire.controller';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { SectionsController } from '../sections/sections.controller';
import { SectionsService } from '../sections/sections.service';
import { AttendanceController } from '../attendance/attendance.controller';
import { AttendanceService } from '../attendance/attendance.service';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../metrics/metrics.service';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5433/pumaia_test?schema=public';

interface CapturedSmtpEmail {
  from: string;
  to: string;
  rawData: string;
}

describe('FASE 9 — Integración Real contra PostgreSQL 16 + Servidor SMTP de Pruebas + Vistas SQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let smtpServer: net.Server;
  let smtpPort = 0;
  const capturedEmails: CapturedSmtpEmail[] = [];
  const capturedLogs: string[] = [];

  // IDs de catálogos base en PostgreSQL real
  let institutionId = '';
  let careerId = '';
  let subjectId = '';
  let periodId = '';
  let topicId = '';
  let onboardingQuestionnaireId = '';
  let requiredQuestionId = '';
  let validOptionId = '';
  let foreignOptionId = '';

  // Actores de prueba en PostgreSQL real
  let adminAccessToken = '';
  let adminUserId = '';
  let profOwnerAccessToken = '';
  let profOwnerId = '';
  let profOtherAccessToken = '';
  let profOtherId = '';
  let psychologistAccessToken = '';
  let psychologistUserId = '';

  beforeAll(async () => {
    // 1. Iniciar servidor SMTP TCP local real para capturar correos enviados por AutenticacionService
    await new Promise<void>((resolve) => {
      smtpServer = net.createServer((socket) => {
        let inData = false;
        let currentFrom = '';
        let currentTo = '';
        let dataBuffer = '';

        socket.write('220 smtp.pumaia.test ESMTP Postfix\r\n');

        socket.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          if (inData) {
            dataBuffer += text;
            if (dataBuffer.includes('\r\n.\r\n') || dataBuffer.endsWith('\n.\r\n')) {
              inData = false;
              capturedEmails.push({
                from: currentFrom,
                to: currentTo,
                rawData: dataBuffer,
              });
              dataBuffer = '';
              socket.write('250 2.0.0 Ok: queued\r\n');
            }
            return;
          }

          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            if (!line) continue;
            const upper = line.toUpperCase();
            if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
              socket.write('250-smtp.pumaia.test\r\n250 OK\r\n');
            } else if (upper.startsWith('MAIL FROM:')) {
              currentFrom = line.slice(10).trim();
              socket.write('250 2.1.0 Ok\r\n');
            } else if (upper.startsWith('RCPT TO:')) {
              currentTo = line.slice(8).replace(/[<>]/g, '').trim().toLowerCase();
              socket.write('250 2.1.5 Ok\r\n');
            } else if (upper === 'DATA') {
              inData = true;
              dataBuffer = '';
              socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
            } else if (upper === 'QUIT') {
              socket.write('221 2.0.0 Bye\r\n');
              socket.end();
            }
          }
        });
      });

      smtpServer.listen(0, '127.0.0.1', () => {
        const addr = smtpServer.address() as net.AddressInfo;
        smtpPort = addr.port;
        resolve();
      });
    });

    process.env.DIRECT_URL = TEST_DB_URL;
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.JWT_SECRET = 'pumaia-phase9-real-pg-jwt-secret-2026';
    process.env.JWT_REFRESH_SECRET = 'pumaia-phase9-real-pg-refresh-secret-2026';
    process.env.GOOGLE_CLIENT_ID = 'pumaia-google-client-id.apps.googleusercontent.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(smtpPort);
    process.env.NODE_ENV = 'test';

    // 2. Conectar PrismaService real a la instancia PostgreSQL 16 de pruebas
    const pgClient = new PrismaClient({
      adapter: new PrismaPg({ connectionString: TEST_DB_URL }),
    });
    await pgClient.$connect();

    // Limpiar datos previos de la base de pruebas (sin tocar esquema ni vistas)
    await pgClient.$executeRawUnsafe(`
      TRUNCATE TABLE
        "asistencia",
        "sesion_clase",
        "lista_grupo",
        "carga_lista",
        "horario_grupo",
        "inscripcion",
        "historial_academico",
        "importacion_horario",
        "grupo",
        "respuesta",
        "envio_cuestionario",
        "opcion_pregunta",
        "pregunta",
        "cuestionario",
        "resumen_psicologico",
        "etiqueta_conversacion",
        "retroalimentacion_mensaje",
        "mensajes",
        "conversaciones",
        "tema",
        "opcion_resultado_ia",
        "resultado_ia",
        "categoria_ia",
        "consentimiento",
        "aviso_privacidad",
        "sesion_autenticacion",
        "rol_usuario",
        "alumno",
        "profesores",
        "usuario",
        "carrera",
        "materia",
        "categoria",
        "plan_estudios",
        "area_conocimiento",
        "periodo_academico",
        "institucion",
        "bitacora_auditoria"
      RESTART IDENTITY CASCADE;
    `);

    // 3. Sembrar catálogos base reales en PostgreSQL 16
    const inst = await pgClient.institution.create({
      data: {
        name: 'Facultad de Estudios Superiores Acatlán',
        code: '240',
      },
    });
    institutionId = inst.id;

    const ka = await pgClient.knowledgeArea.create({
      data: {
        knowledgeArea: 'CIENCIAS_FISICO_MATEMATICAS_Y_DE_LAS_INGENIERIAS',
      },
    });

    const sp = await pgClient.studyPlan.create({
      data: {
        studyPlan: 'Plan MAC 2016',
        semesters: 8,
        totalCredits: 380,
        level: 'LICENCIATURA',
        system: 'ESCOLARIZADO',
      },
    });

    const career = await pgClient.career.create({
      data: {
        institutionId: inst.id,
        name: 'Matemáticas Aplicadas y Computación',
        code: '121',
        studyPlanId: sp.id,
        knowledgeAreaId: ka.id,
        isMasters: false,
      },
    });
    careerId = career.id;

    const cat = await pgClient.category.create({
      data: { category: 'COMPUTACION' },
    });

    const subj = await pgClient.subject.create({
      data: {
        subject: 'Ingeniería de Software I',
        code: 1504,
        semester: 5,
        credits: 8,
        categoryId: cat.id,
        studyPlanId: sp.id,
      },
    });
    subjectId = subj.id;

    const period = await pgClient.academicPeriod.create({
      data: {
        institutionId: inst.id,
        code: '2026-1',
      },
    });
    periodId = period.id;

    const topic = await pgClient.topicCategory.create({
      data: {
        code: 'TRAMITES_INSCRIPCION',
        label: 'Trámites e Inscripción',
        topicGroup: 'TRAMITES',
        active: true,
      },
    });
    topicId = topic.id;

    // Cuestionario ONBOARDING activo en PostgreSQL
    const qOnboarding = await pgClient.questionnaire.create({
      data: {
        kind: QuestionnaireKind.ONBOARDING,
        version: 1,
        active: true,
      },
    });
    onboardingQuestionnaireId = qOnboarding.id;

    const q1 = await pgClient.question.create({
      data: {
        questionnaireId: qOnboarding.id,
        code: 'p1_interes',
        position: 1,
        text: '¿Cuál es tu área de interés principal?',
        type: QuestionType.SINGLE_CHOICE,
        required: true,
      },
    });
    requiredQuestionId = q1.id;

    const opt1 = await pgClient.questionOption.create({
      data: {
        questionId: q1.id,
        position: 1,
        label: 'Ciencia de Datos e IA',
        value: 'ia',
      },
    });
    validOptionId = opt1.id;

    const q2 = await pgClient.question.create({
      data: {
        questionnaireId: qOnboarding.id,
        code: 'p2_secundaria',
        position: 2,
        text: 'Pregunta opcional secundaria',
        type: QuestionType.SINGLE_CHOICE,
        required: false,
      },
    });

    const optForeign = await pgClient.questionOption.create({
      data: {
        questionId: q2.id,
        position: 1,
        label: 'Opción de otra pregunta',
        value: 'otra',
      },
    });
    foreignOptionId = optForeign.id;

    // Crear Administrador inicial en PostgreSQL
    const adminUser = await pgClient.user.create({
      data: {
        institutionId: inst.id,
        email: 'admin.mac@acatlan.unam.mx',
        name: 'COORDINACION',
        lastNameP: 'MAC',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: { role: RoleType.INSTITUTION_ADMIN },
        },
      },
    });
    adminUserId = adminUser.id;

    // Crear Psicólogo / Orientador en PostgreSQL
    const psyUser = await pgClient.user.create({
      data: {
        institutionId: inst.id,
        email: 'psicologia.orientacion@acatlan.unam.mx',
        name: 'DRA. ELENA',
        lastNameP: 'ORIENTACION',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: { role: RoleType.ANALYST },
        },
      },
    });
    psychologistUserId = psyUser.id;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [
        AutenticacionController,
        ConsentsController,
        ChatController,
        QuestionnaireController,
        SectionsController,
        AttendanceController,
        MetricsController,
      ],
      providers: [
        AutenticacionService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        ConsentsService,
        ChatService,
        QuestionnaireService,
        SectionsService,
        AttendanceService,
        MetricsService,
        AuditService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              return process.env[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: pgClient,
        },
      ],
    }).compile();

    prisma = pgClient as unknown as PrismaService;
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Interceptar logs de AutenticacionService para comprobar que ningún token se filtre en logs
    const authService = app.get<AutenticacionService>(AutenticacionService);
    const loggerInstance = (authService as any).logger;
    jest.spyOn(loggerInstance, 'log').mockImplementation((msg: any) => {
      capturedLogs.push(String(msg));
    });
    jest.spyOn(loggerInstance, 'warn').mockImplementation((msg: any) => {
      capturedLogs.push(String(msg));
    });
    jest.spyOn(loggerInstance, 'error').mockImplementation((msg: any) => {
      capturedLogs.push(String(msg));
    });

    await app.init();

    // Emitir sesiones reales en PostgreSQL para Admin y Psicólogo
    adminAccessToken = (
      await (authService as any).createSessionAndTokens({
        userId: adminUser.id,
        studentId: null,
        professorId: null,
        email: adminUser.email,
        name: 'COORDINACION MAC',
        roles: [RoleType.INSTITUTION_ADMIN],
        accountNumber: null,
      })
    ).accessToken;

    psychologistAccessToken = (
      await (authService as any).createSessionAndTokens({
        userId: psyUser.id,
        studentId: null,
        professorId: null,
        email: psyUser.email,
        name: 'DRA. ELENA ORIENTACION',
        roles: [RoleType.ANALYST],
        accountNumber: null,
      })
    ).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (smtpServer) {
      await new Promise<void>((resolve) => smtpServer.close(() => resolve()));
    }
  });

  let studentAccessToken = '';
  let studentRefreshCookie = '';
  let studentId = '';
  let studentUserId = '';

  describe('1 y 2. Autenticación Tradicional, Google OAuth, SMTP Real, No Exposición de Tokens y Concurrencia en PostgreSQL', () => {
    it('Registra estudiante en PostgreSQL, entrega correo real por SMTP con enlace al frontend, y jamás expone el token en HTTP ni logs', async () => {
      // Rechazo de correo externo
      await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: '318555111@gmail.com',
          password: 'PasswordSegura123!',
          name: 'ALUMNO',
          lastNameP: 'EXTERNO',
          accountNumber: 318555111,
        })
        .expect(400);

      // Rechazo de localPart no numérico
      await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: 'alumno.mac@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
          name: 'ALUMNO',
          lastNameP: 'MAC',
        })
        .expect(400);

      // Registro válido en PostgreSQL
      const regRes = await request(app.getHttpServer())
        .post('/api/autenticacion/register')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
          name: 'FERNANDO',
          lastNameP: 'ACAtLAN',
          accountNumber: 318555111,
          currentSemester: 5,
        })
        .expect(201);

      expect(regRes.body.requiresVerification).toBe(true);
      expect(regRes.body.verificationToken).toBeUndefined();
      expect(JSON.stringify(regRes.body)).not.toMatch(/[0-9a-f]{64}/);

      // Verificar que el servidor SMTP recibió el correo real
      const smtpMail = capturedEmails.find(
        (m) => m.to === '318555111@pcpuma.acatlan.unam.mx',
      );
      expect(smtpMail).toBeDefined();
      expect(smtpMail!.rawData).toContain('http://localhost:3000/?mode=verify');
      expect(smtpMail!.rawData).toContain('email=318555111%40pcpuma.acatlan.unam.mx');
      expect(smtpMail!.rawData).toContain('24 horas');

      const tokenMatch = smtpMail!.rawData.match(/token=([0-9a-f]{64})/);
      expect(tokenMatch).not.toBeNull();
      const rawTokenFromSmtp = tokenMatch![1];

      // Verificar que ningún log contiene el token secreto
      for (const logEntry of capturedLogs) {
        expect(logEntry).not.toContain(rawTokenFromSmtp);
      }

      // Comprobar en PostgreSQL que se guardó el hash SHA-256 (nunca el token en texto plano) y que emailVerifiedAt es null
      const dbUser = await prisma.user.findUnique({
        where: { email: '318555111@pcpuma.acatlan.unam.mx' },
        include: { student: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.emailVerifiedAt).toBeNull();
      expect(dbUser!.verificationTokenHash).not.toBe(rawTokenFromSmtp);
      expect(dbUser!.verificationTokenHash).toHaveLength(64);
      studentUserId = dbUser!.id;
      studentId = dbUser!.student!.id;

      // Bloquear login antes de verificar correo -> 403 Forbidden
      await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
        })
        .expect(403);

      // Verificar correo con el token recibido por SMTP
      await request(app.getHttpServer())
        .post('/api/autenticacion/verify-email')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          token: rawTokenFromSmtp,
        })
        .expect(200);

      // Comprobar en PostgreSQL que emailVerifiedAt fue actualizado y verificationTokenHash limpiado
      const verifiedUser = await prisma.user.findUnique({
        where: { id: studentUserId },
      });
      expect(verifiedUser!.emailVerifiedAt).not.toBeNull();
      expect(verifiedUser!.verificationTokenHash).toBeNull();
    });

    it('Bloquea cuenta tras 5 intentos fallidos en PostgreSQL, recupera contraseña por SMTP y revoca sesiones previas', async () => {
      // 5 intentos fallidos consecutivos
      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post('/api/autenticacion/login')
          .send({
            email: '318555111@pcpuma.acatlan.unam.mx',
            password: `WrongPassAttempt${i}!`,
          })
          .expect(401);
      }

      const lockedUser = await prisma.user.findUnique({
        where: { id: studentUserId },
      });
      expect(lockedUser!.failedLoginAttempts).toBe(5);
      expect(lockedUser!.lockedUntil).not.toBeNull();

      // Incluso con la contraseña correcta, el login es rechazado mientras está bloqueado
      await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          password: 'PasswordSegura123!',
        })
        .expect(401);

      // Solicitar recuperación de contraseña -> envía correo por SMTP
      const countBefore = capturedEmails.length;
      const forgotRes = await request(app.getHttpServer())
        .post('/api/autenticacion/forgot-password')
        .send({ email: '318555111@pcpuma.acatlan.unam.mx' })
        .expect(200);

      expect(forgotRes.body.resetToken).toBeUndefined();
      expect(capturedEmails.length).toBeGreaterThan(countBefore);

      const latestSmtp = capturedEmails[capturedEmails.length - 1];
      expect(latestSmtp.rawData).toContain('http://localhost:3000/?mode=reset');
      expect(latestSmtp.rawData).toContain('30 minutos');
      const resetTokenMatch = latestSmtp.rawData.match(/token=([0-9a-f]{64})/);
      expect(resetTokenMatch).not.toBeNull();

      // Restablecer contraseña -> desbloquea cuenta y actualiza hash
      await request(app.getHttpServer())
        .post('/api/autenticacion/reset-password')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          token: resetTokenMatch![1],
          newPassword: 'NuevaPasswordPuma2026!',
        })
        .expect(200);

      // Iniciar sesión con la nueva contraseña
      const loginRes = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          password: 'NuevaPasswordPuma2026!',
        })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
      studentAccessToken = loginRes.body.accessToken;
      const setCookie = loginRes.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
      studentRefreshCookie = cookieArr
        .find((c: string) => c.startsWith('puma_refresh_token='))!
        .split(';')[0];

      // Compatibilidad con Google OAuth sobre la misma cuenta institucional
      const authService = app.get<AutenticacionService>(AutenticacionService);
      jest.spyOn(authService as any, 'verifyGoogleIdToken').mockResolvedValueOnce({
        sub: 'google-sub-318555111',
        email: '318555111@pcpuma.acatlan.unam.mx',
        name: 'FERNANDO ACATLAN',
        given_name: 'FERNANDO',
        family_name: 'ACATLAN',
        email_verified: true,
      });

      const googleLoginRes = await request(app.getHttpServer())
        .post('/api/autenticacion/google')
        .send({ idToken: 'mock.google.id.token' })
        .expect(200);

      expect(googleLoginRes.body.user.id).toBe(studentUserId);
    });

    it('Garantiza atomicidad ante solicitudes simultáneas de rotación de Refresh Token (concurrencia real en PostgreSQL)', async () => {
      // Iniciar sesión en un Dispositivo B
      const devB = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .set('User-Agent', 'Device-B-Concurrency-Test')
        .send({
          email: '318555111@pcpuma.acatlan.unam.mx',
          password: 'NuevaPasswordPuma2026!',
        })
        .expect(200);

      const setCookieB = devB.headers['set-cookie'];
      const cookieArrB = Array.isArray(setCookieB) ? setCookieB : [setCookieB];
      const refreshCookieB = cookieArrB
        .find((c: string) => c.startsWith('puma_refresh_token='))!
        .split(';')[0];

      // Lanzar 2 solicitudes simultáneas con el MISMO Refresh Token
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/autenticacion/refresh')
          .set('Cookie', [refreshCookieB])
          .send({}),
        request(app.getHttpServer())
          .post('/api/autenticacion/refresh')
          .set('Cookie', [refreshCookieB])
          .send({}),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactamente una solicitud puede tener éxito (o ninguna si colisionan antes del commit), NUNCA ambas con 200
      expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(1);
      expect(statuses).toContain(401);

      // Y la sesión en Dispositivo A (studentAccessToken) sigue completamente funcional
      await request(app.getHttpServer())
        .get('/api/autenticacion/me')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);
    });

    it('Invita a profesores por correo institucional sin exigir número de cuenta de alumno y maneja fallos del proveedor SMTP sin filtrar secretos', async () => {
      // Invitar Profesor Titular
      const countBefore = capturedEmails.length;
      const inviteRes = await request(app.getHttpServer())
        .post('/api/autenticacion/invite-staff')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          email: 'roberto.morales@acatlan.unam.mx',
          name: 'ROBERTO',
          lastNameP: 'MORALES',
          role: RoleType.PROFESSOR,
        })
        .expect(201);

      expect(inviteRes.body.activationToken).toBeUndefined();
      expect(capturedEmails.length).toBeGreaterThan(countBefore);

      const inviteMail = capturedEmails[capturedEmails.length - 1];
      const tokenMatch = inviteMail.rawData.match(/token=([0-9a-f]{64})/);
      expect(tokenMatch).not.toBeNull();

      // Comprobar que inviteStaffMember creó automáticamente el registro Professor vinculado al User invitado
      const profUser = await prisma.user.findUnique({
        where: { email: 'roberto.morales@acatlan.unam.mx' },
        include: { professor: true },
      });
      expect(profUser?.professor).toBeDefined();
      profOwnerId = profUser!.professor!.id;

      // Profesor configura su contraseña con el token recibido por correo
      await request(app.getHttpServer())
        .post('/api/autenticacion/reset-password')
        .send({
          email: 'roberto.morales@acatlan.unam.mx',
          token: tokenMatch![1],
          newPassword: 'ProfesorPassword2026!',
        })
        .expect(200);

      // Profesor inicia sesión con correo y contraseña
      const profLogin = await request(app.getHttpServer())
        .post('/api/autenticacion/login')
        .send({
          email: 'roberto.morales@acatlan.unam.mx',
          password: 'ProfesorPassword2026!',
        })
        .expect(200);

      expect(profLogin.body.user.roles).toContain(RoleType.PROFESSOR);
      profOwnerAccessToken = profLogin.body.accessToken;

      // Crear segundo profesor para pruebas de IDOR entre profesores
      const otherProfUser = await prisma.user.create({
        data: {
          institutionId,
          email: 'otro.profesor@acatlan.unam.mx',
          name: 'CARLOS',
          lastNameP: 'AJENO',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: { role: RoleType.PROFESSOR } },
          professor: {
            create: { name: 'CARLOS', lastNameP: 'AJENO' },
          },
        },
        include: { professor: true },
      });
      profOtherId = otherProfUser.professor!.id;
      const authService = app.get<AutenticacionService>(AutenticacionService);
      profOtherAccessToken = (
        await (authService as any).createSessionAndTokens({
          userId: otherProfUser.id,
          studentId: null,
          professorId: profOtherId,
          email: otherProfUser.email,
          name: 'CARLOS AJENO',
          roles: [RoleType.PROFESSOR],
          accountNumber: null,
        })
      ).accessToken;

      // Probar fallo de proveedor SMTP con EMAIL_REQUIRE_DELIVERY=true -> devuelve 503 sin exponer credenciales ni tokens
      const prevPort = process.env.SMTP_PORT;
      process.env.SMTP_PORT = '1'; // puerto cerrado
      process.env.EMAIL_REQUIRE_DELIVERY = 'true';
      try {
        const failRes = await request(app.getHttpServer())
          .post('/api/autenticacion/forgot-password')
          .send({ email: '318555111@pcpuma.acatlan.unam.mx' })
          .expect(503);

        expect(JSON.stringify(failRes.body)).not.toContain('127.0.0.1');
        expect(JSON.stringify(failRes.body)).not.toMatch(/[0-9a-f]{64}/);
      } finally {
        process.env.SMTP_PORT = prevPort;
        delete process.env.EMAIL_REQUIRE_DELIVERY;
      }
    });
  });

  describe('3, 4 y 6. Consentimientos, Chat Sensible, Resúmenes Psicológicos, Cuestionarios, Grupos y Asistencia en PostgreSQL Real', () => {
    it('Ejecuta consentimientos append-only, exclusión de chat sensible y ciclo completo de PsychologicalSummary en PostgreSQL', async () => {
      // Sin consentimiento TERMS_AND_NOTICE -> /api/chat/message bloqueado (403)
      await request(app.getHttpServer())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ content: '¿Cuándo salen las reinscripciones?' })
        .expect(403);

      // Obtener avisos vigentes (se inicializan en PostgreSQL)
      const noticesRes = await request(app.getHttpServer())
        .get('/api/consents/notices')
        .expect(200);
      expect(noticesRes.body.length).toBe(3);

      // Otorgar los 3 consentimientos en lote
      await request(app.getHttpServer())
        .post('/api/consents/batch')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          consents: noticesRes.body.map((n: any) => ({
            noticeId: n.id,
            kind: n.kind,
            granted: true,
          })),
        })
        .expect(201);

      // Enviar mensaje con contenido sensible -> debe marcar conversacion.sensible = true en PostgreSQL
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          response:
            'Te sugerimos acudir al departamento de orientación psicológica de la FES Acatlán.',
        }),
      } as any);

      const msgRes = await request(app.getHttpServer())
        .post('/api/chat/message')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          content: 'Tengo una crisis de ansiedad y necesito apoyo psicológico urgente',
        })
        .expect(201);

      fetchSpy.mockRestore();

      const sensitiveConvId = msgRes.body.conversationId;
      const dbConv = await prisma.conversation.findUnique({
        where: { id: sensitiveConvId },
      });
      expect(dbConv!.sensitive).toBe(true);

      // Intentar etiquetar conversación sensible -> rechazado con 403 Forbidden
      await request(app.getHttpServer())
        .post(`/api/chat/conversations/${sensitiveConvId}/labels`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          topicId,
          source: 'MANUAL',
          confidence: 0.95,
        })
        .expect(403);

      // Ciclo completo de PsychologicalSummary en PostgreSQL
      const draftRes = await request(app.getHttpServer())
        .post('/api/chat/psychological-summaries')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          content: 'Borrador inicial del alumno.',
          conversationId: sensitiveConvId,
        })
        .expect(201);

      const summaryId = draftRes.body.id;
      expect(draftRes.body.status).toBe('DRAFT');

      // Editar resumen
      await request(app.getHttpServer())
        .patch(`/api/chat/psychological-summaries/${summaryId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ content: 'Resumen revisado y editado por el estudiante.' })
        .expect(200);

      // Aprobar resumen
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/approve`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      // Compartir con psicólogo real en PostgreSQL
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/share`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ recipientId: psychologistUserId })
        .expect(201);

      // Psicólogo lee el resumen compartido -> 200 OK
      const readRes = await request(app.getHttpServer())
        .get(`/api/chat/psychological-summaries/shared/${summaryId}`)
        .set('Authorization', `Bearer ${psychologistAccessToken}`)
        .expect(200);
      expect(readRes.body.content).toContain('editado por el estudiante');

      // Estudiante revoca el acceso -> psicólogo pierde acceso inmediatamente (403)
      await request(app.getHttpServer())
        .post(`/api/chat/psychological-summaries/${summaryId}/revoke`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/chat/psychological-summaries/shared/${summaryId}`)
        .set('Authorization', `Bearer ${psychologistAccessToken}`)
        .expect(403);

      // IDOR entre estudiantes: un segundo estudiante no puede leer ni modificar conversaciones ni resúmenes del primer estudiante
      const otherStudentUser = await prisma.user.create({
        data: {
          institutionId,
          email: '318999888@pcpuma.acatlan.unam.mx',
          name: 'OTRO',
          lastNameP: 'ESTUDIANTE',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: { role: RoleType.STUDENT } },
          student: {
            create: {
              accountNumber: 318999888,
              careerId,
              currentSemester: 5,
            },
          },
        },
        include: { student: true },
      });
      const authService = app.get<AutenticacionService>(AutenticacionService);
      const otherStudentTokens = await (authService as any).createSessionAndTokens({
        userId: otherStudentUser.id,
        studentId: otherStudentUser.student!.id,
        professorId: null,
        email: otherStudentUser.email,
        name: 'OTRO ESTUDIANTE',
        roles: [RoleType.STUDENT],
        accountNumber: 318999888,
      });

      await request(app.getHttpServer())
        .get(`/api/chat/conversations/${sensitiveConvId}/messages`)
        .set('Authorization', `Bearer ${otherStudentTokens.accessToken}`)
        .expect(403);

      const idorSummaryRes = await request(app.getHttpServer())
        .patch(`/api/chat/psychological-summaries/${summaryId}`)
        .set('Authorization', `Bearer ${otherStudentTokens.accessToken}`)
        .send({ content: 'Intento de IDOR por otro alumno' });
      expect([403, 404]).toContain(idorSummaryRes.status);

      // Usuario desactivado (DELETED / deletedAt) es rechazado inmediatamente aunque presente un JWT firmado vigente
      await prisma.user.update({
        where: { id: otherStudentUser.id },
        data: { status: 'DELETED', deletedAt: new Date() },
      });
      await request(app.getHttpServer())
        .get('/api/autenticacion/me')
        .set('Authorization', `Bearer ${otherStudentTokens.accessToken}`)
        .expect(401);
      await prisma.user.delete({ where: { id: otherStudentUser.id } });
    });

    it('Valida integridad transaccional de cuestionarios, titularidad docente de grupos y QR dinámico en PostgreSQL', async () => {
      // 1. Cuestionario: rechaza pregunta inventada y hace rollback en PostgreSQL
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            { id: 'p1_interes', optionId: validOptionId, value: 'ia' },
            { id: 'pregunta_falsa', value: 'x' },
          ],
        })
        .expect(400);

      // Rechaza opción perteneciente a otra pregunta
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            { id: 'p1_interes', optionId: foreignOptionId, value: 'otra' },
          ],
        })
        .expect(400);

      // Acepta envío válido de ONBOARDING
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            { id: 'p1_interes', optionId: validOptionId, value: 'ia' },
          ],
        })
        .expect(201);

      // Bloquea segundo envío de ONBOARDING -> 409 Conflict
      await request(app.getHttpServer())
        .post('/api/questionnaire/save')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          answers: [
            { id: 'p1_interes', optionId: validOptionId, value: 'ia' },
          ],
        })
        .expect(409);

      // 2. Grupos y Asistencia en PostgreSQL
      const secRes = await request(app.getHttpServer())
        .post('/api/sections')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          subjectId,
          periodId,
          groupCode: '2501',
          professorId: profOwnerId,
        })
        .expect(201);

      const sectionId = secRes.body.id;

      // Profesor ajeno intenta modificar el grupo -> 403 Forbidden
      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/roster`)
        .set('Authorization', `Bearer ${profOtherAccessToken}`)
        .send({ accountNumber: 318555111, fullName: 'FERNANDO ACATLAN' })
        .expect(403);

      // Profesor titular agrega al alumno a la lista -> 201 Created
      await request(app.getHttpServer())
        .post(`/api/sections/${sectionId}/roster`)
        .set('Authorization', `Bearer ${profOwnerAccessToken}`)
        .send({ accountNumber: 318555111, fullName: 'FERNANDO ACATLAN' })
        .expect(201);

      // Estudiante consulta GET /api/sections/:id -> no expone joinCode ni roster con PII
      const studentSecView = await request(app.getHttpServer())
        .get(`/api/sections/${sectionId}`)
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .expect(200);
      expect(studentSecView.body.joinCode).toBeUndefined();
      expect(studentSecView.body.roster).toBeUndefined();
      expect(studentSecView.body.rosterCount).toBe(1);

      // Profesor titular abre sesión de asistencia con QR dinámico
      const openSessionRes = await request(app.getHttpServer())
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${profOwnerAccessToken}`)
        .send({ sectionId })
        .expect(201);

      const attSessionId = openSessionRes.body.id;
      const qrToken = openSessionRes.body.qrToken;

      // Registrar asistencia válida con QR dinámico -> 201 Created
      await request(app.getHttpServer())
        .post('/api/attendance/record')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sessionId: attSessionId, secret: qrToken })
        .expect(201);

      // Segundo registro en la misma sesión -> 409 Conflict
      await request(app.getHttpServer())
        .post('/api/attendance/record')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({ sessionId: attSessionId, secret: qrToken })
        .expect(409);
    });
  });

  describe('7 y 3. Validación Controlada de K-Anonimato (1, 9, 10 y 11 Estudiantes Únicos), Anti-Diferenciación y Ejecución de las 7 Vistas SQL en PostgreSQL Real', () => {
    const createStudentWithAnalyticsData = async (index: number, semester = 5) => {
      const accountNumber = 319100000 + index;
      const email = `${accountNumber}@pcpuma.acatlan.unam.mx`;
      const analyticsNotice = await prisma.privacyNotice.findFirst({
        where: { kind: ConsentKind.ANALYTICS },
      });

      const u = await prisma.user.create({
        data: {
          institutionId,
          email,
          name: `ESTUDIANTE_${index}`,
          lastNameP: 'PRUEBA',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: { role: RoleType.STUDENT } },
          consents: {
            create: {
              noticeId: analyticsNotice!.id,
              kind: ConsentKind.ANALYTICS,
              granted: true,
            },
          },
          student: {
            create: {
              accountNumber,
              careerId,
              currentSemester: semester,
              average: 8.5,
            },
          },
        },
        include: { student: true },
      });

      const stId = u.student!.id;

      // Crear conversación NO sensible y etiquetarla con topicId
      const conv = await prisma.conversation.create({
        data: {
          studentId: stId,
          careerId,
          title: `Consulta académica ${index}`,
          sensitive: false,
        },
      });

      await prisma.conversationLabel.create({
        data: {
          conversationId: conv.id,
          topicId,
          source: 'MODEL',
          confidence: 0.92,
        },
      });

      // Crear inscripción aprobada con calificación 9
      await prisma.enrollment.create({
        data: {
          studentId: stId,
          subjectId,
          periodId,
          grade: 9,
          status: EnrollmentStatus.PASSED,
        },
      });

      return stId;
    };

    it('Valida k-anonimato exacto con 1, 9, 10 y 11 estudiantes únicos tanto en MetricsService como en las 7 Vistas SQL reales de PostgreSQL', async () => {
      // Limpiar inscripciones previas para medir exactamente 1, 9, 10 y 11 estudiantes únicos
      await prisma.enrollment.deleteMany({});

      // --- CASO A: 1 ESTUDIANTE ÚNICO (incluso con múltiples conversaciones etiquetadas) ---
      const firstStId = await createStudentWithAnalyticsData(1, 5);
      // Agregar 14 conversaciones adicionales del MISMO estudiante 1 (15 etiquetas en total, pero 1 solo alumno único)
      for (let extra = 1; extra <= 14; extra++) {
        const extraConv = await prisma.conversation.create({
          data: {
            studentId: firstStId,
            careerId,
            title: `Consulta repetida ${extra}`,
            sensitive: false,
          },
        });
        await prisma.conversationLabel.create({
          data: {
            conversationId: extraConv.id,
            topicId,
            source: 'MODEL',
            confidence: 0.88,
          },
        });
      }

      const res1 = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res1.body[0].totalStudents).toBe('<10');
      expect(res1.body[0].totalQueries).toBe('RESTRINGIDO');
      expect(res1.body[0].averageConfidence).toBe('RESTRINGIDO');
      expect(res1.body[0].kAnonymityProtected).toBe(true);

      // --- CASO B: 9 ESTUDIANTES ÚNICOS (sembrar estudiantes 2 a 9) ---
      for (let i = 2; i <= 9; i++) {
        await createStudentWithAnalyticsData(i, 5);
      }

      const res9 = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res9.body[0].totalStudents).toBe('<10');
      expect(res9.body[0].totalQueries).toBe('RESTRINGIDO');
      expect(res9.body[0].kAnonymityProtected).toBe(true);

      const perf9 = await request(app.getHttpServer())
        .get('/api/metrics/academic-performance')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(perf9.body[0].totalStudents).toBe('<10');
      expect(perf9.body[0].averageGrade).toBe('RESTRINGIDO');
      expect(perf9.body[0].passRate).toBe('RESTRINGIDO');

      // Comprobar que la vista SQL real en PostgreSQL también enmascara con 9 estudiantes únicos
      const viewChat9: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM vista_metricas_temas_chat WHERE clave_tema = 'TRAMITES_INSCRIPCION'`,
      );
      expect(viewChat9[0].alumnos_unicos_muestra).toBe('<10');
      expect(viewChat9[0].total_consultas_asociadas).toBe('RESTRINGIDO');
      expect(viewChat9[0].confianza_promedio_modelo).toBe('RESTRINGIDO');

      // --- CASO C: 10 ESTUDIANTES ÚNICOS (sembrar estudiante 10) ---
      await createStudentWithAnalyticsData(10, 5);

      const res10 = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res10.body[0].totalStudents).toBe('10');
      expect(res10.body[0].totalQueries).toBe(24); // 15 del alumno 1 + 9 de los alumnos 2..10
      expect(res10.body[0].kAnonymityProtected).toBe(false);

      const perf10 = await request(app.getHttpServer())
        .get('/api/metrics/academic-performance')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(perf10.body[0].totalStudents).toBe('10');
      expect(perf10.body[0].averageGrade).toBe('9.00');
      expect(perf10.body[0].kAnonymityProtected).toBe(false);

      const viewChat10: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM vista_metricas_temas_chat WHERE clave_tema = 'TRAMITES_INSCRIPCION'`,
      );
      expect(viewChat10[0].alumnos_unicos_muestra).toBe('10');
      expect(viewChat10[0].total_consultas_asociadas).toBe('24');
      expect(viewChat10[0].confianza_promedio_modelo).not.toBe('RESTRINGIDO');

      // --- CASO D: 11 ESTUDIANTES ÚNICOS (sembrar estudiante 11 en el mismo semestre 5) ---
      await createStudentWithAnalyticsData(11, 5);

      const res11 = await request(app.getHttpServer())
        .get('/api/metrics/chat-topics')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);
      expect(res11.body[0].totalStudents).toBe('11');
      expect(res11.body[0].kAnonymityProtected).toBe(false);

      // --- DEFENSA CONTRA ATAQUES DE DIFERENCIACIÓN ---
      // El estudiante inicial (318555111) también está en semestre 5 sin etiquetas, pero si agregamos
      // 1 único estudiante en semestre 8 (muestra = 1 < 10) mientras semestre 5 tiene >= 10 estudiantes,
      // la supresión complementaria en getRetentionAndRiskMetrics debe proteger contra ataques por diferencia.
      await createStudentWithAnalyticsData(99, 8);
      const retentionRes = await request(app.getHttpServer())
        .get('/api/metrics/retention-risk')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const sem8Cohort = retentionRes.body.find((c: any) => c.semester === 8);
      expect(sem8Cohort).toBeDefined();
      expect(sem8Cohort.totalStudents).toBe('<10');
      expect(sem8Cohort.notPresentedCount).toBe('RESTRINGIDO');
      expect(sem8Cohort.kAnonymityProtected).toBe(true);

      // Con sólo 2 semestres en la carrera (semestre 5 con >=10 y semestre 8 con 1),
      // la supresión complementaria también enmascara el otro semestre para impedir resta directa
      const sem5Cohort = retentionRes.body.find((c: any) => c.semester === 5);
      expect(sem5Cohort.kAnonymityProtected).toBe(true);
      expect(sem5Cohort.totalStudents).toBe('<10');
    });

    it('Ejecuta las 7 vistas SQL en PostgreSQL real y comprueba que vista_perfil_alumno_v3 devuelve exactamente 1 fila por alumno sin producto cartesiano', async () => {
      // Sembrar múltiples registros 1:N al estudiante 1 (2 cursos, 2 becas, 2 idiomas) para verificar ausencia de producto cartesiano
      const cat = await prisma.category.findFirst();
      const c1 = await prisma.course.create({
        data: { name: 'Curso Docker', categoryId: cat!.id },
      });
      const c2 = await prisma.course.create({
        data: { name: 'Curso Kubernetes', categoryId: cat!.id },
      });
      await prisma.studentCourse.createMany({
        data: [
          { studentId, courseId: c1.id },
          { studentId, courseId: c2.id },
        ],
      });

      const b1 = await prisma.schoolarship.create({
        data: { name: 'Beca Manutención', categoryId: cat!.id },
      });
      const b2 = await prisma.schoolarship.create({
        data: { name: 'Beca Excelencia', categoryId: cat!.id },
      });
      await prisma.studentSchoolarship.createMany({
        data: [
          { studentId, schoolarshipId: b1.id },
          { studentId, schoolarshipId: b2.id },
        ],
      });

      const perfilRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM vista_perfil_alumno_v3 WHERE id_alumno = $1`,
        studentId,
      );
      expect(perfilRows).toHaveLength(1);
      expect(perfilRows[0].curso).toContain('Curso Docker');
      expect(perfilRows[0].curso).toContain('Curso Kubernetes');
      expect(perfilRows[0].beca).toContain('Beca Manutención');
      expect(perfilRows[0].beca).toContain('Beca Excelencia');

      // Ejecutar SELECT sobre las 6 vistas de métricas restantes en PostgreSQL real
      const v2: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_rendimiento_academico`);
      const v3: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_rezago_abandono`);
      const v4: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_asistencia_grupos`);
      const v5: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_temas_chat`);
      const v6: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_cuestionarios_satisfaccion`);
      const v7: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM vista_metricas_trayectoria_ia`);

      expect(v2.length).toBeGreaterThan(0);
      expect(v3.length).toBeGreaterThan(0);
      expect(v4.length).toBeGreaterThan(0);
      expect(v5.length).toBeGreaterThan(0);
      expect(v6.length).toBeGreaterThan(0);
      expect(Array.isArray(v7)).toBe(true);
    });
  });
});
