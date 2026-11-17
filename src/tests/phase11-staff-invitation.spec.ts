import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { AutenticacionService } from '../autenticacion/autenticacion.service';
import { StaffController } from '../autenticacion/staff/staff.controller';
import { ROLES_KEY } from '../autenticacion/decorators/roles.decorator';

const ADMIN = {
  id: 'admin-1',
  name: 'Saúl',
  lastNameP: 'Casas',
  lastNameM: 'Lorenzo',
};

function invitedUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u-inv',
    email: 'miniomcap@gmail.com',
    name: 'Mini',
    lastNameP: 'Prueba',
    lastNameM: null,
    status: UserStatus.INVITED,
    googleSub: null,
    emailVerifiedAt: null,
    deletedAt: null,
    avatarUrl: null,
    roles: [{ role: RoleType.PROFESSOR }],
    professor: { id: 'p1' },
    student: null,
    ...overrides,
  };
}

function build(config: Record<string, string> = {}) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'u-inv' }),
      update: jest.fn().mockResolvedValue({}),
    },
    userRole: { create: jest.fn() },
    professor: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  prisma.$transaction = jest.fn((fn: any) => fn(prisma));
  const audit = { log: jest.fn() };
  const cfg = {
    get: (k: string) =>
      ({ FRONTEND_URL: 'https://pumaia.example.mx/', ...config })[k],
  };
  const service = new AutenticacionService(
    prisma,
    {} as any,
    cfg as any,
    audit as any,
  );
  jest
    .spyOn(service as any, 'getOrCreateDefaultInstitution')
    .mockResolvedValue({ id: 'inst-1' });
  jest.spyOn(service as any, 'createSessionAndTokens').mockResolvedValue({
    accessToken: 'a',
    refreshToken: 'r',
    sessionId: 's',
  });
  return { service, prisma, audit };
}

/** findUnique: según el where devuelve el invitado, el admin o null. */
function routeFindUnique(prisma: any, invited: any) {
  prisma.user.findUnique.mockImplementation(({ where }: any) => {
    if (where.id === 'admin-1') return Promise.resolve(ADMIN);
    if (where.id === invited?.id || where.email === invited?.email)
      return Promise.resolve(invited);
    return Promise.resolve(null);
  });
}

const actions = (audit: { log: jest.Mock }) =>
  audit.log.mock.calls.map((c) => c[0].action);

describe('Fase 11 — Invitación de personal con correo', () => {
  it('crea la invitación, envía el correo (aunque ENABLE_PASSWORD_AUTH esté apagado) y audita', async () => {
    const { service, prisma, audit } = build({ ENABLE_PASSWORD_AUTH: 'false' });
    const invited = invitedUser();
    // 1ª búsqueda (dentro de la transacción) = no existe; después, el invitado.
    let first = true;
    prisma.user.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'admin-1') return Promise.resolve(ADMIN);
      if (where.email && first) {
        first = false;
        return Promise.resolve(null);
      }
      return Promise.resolve(invited);
    });
    const dispatch = jest
      .spyOn(service as any, 'dispatchInstitutionalEmail')
      .mockResolvedValue({ delivered: true, channel: 'SMTP', errorCode: null });

    const res = await service.inviteStaffMember(
      {
        email: ' MiniomCap@Gmail.com ',
        name: 'Mini',
        lastNameP: 'Prueba',
        role: RoleType.PROFESSOR,
        createNewProfessor: true,
      },
      'admin-1',
    );

    expect(res.emailSent).toBe(true);
    expect(res.emailError).toBeNull();
    // Sin contraseña ni token en la invitación.
    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.email).toBe('miniomcap@gmail.com');
    expect(createData.status).toBe(UserStatus.INVITED);
    expect(createData.resetPasswordTokenHash).toBeUndefined();

    const [to, subject, text, meta] = dispatch.mock.calls[0] as any[];
    expect(to).toBe('miniomcap@gmail.com');
    expect(subject).toMatch(/PumaIA/);
    expect(text).toContain('Saúl Casas Lorenzo');
    expect(text).toContain('rol de Profesor');
    expect(text).toContain(
      'Entra con tu cuenta de Google usando exactamente este correo: miniomcap@gmail.com',
    );
    expect(text).toContain('https://pumaia.example.mx/profesores');
    expect(meta.html).toContain('href="https://pumaia.example.mx/profesores"');
    expect(meta.token).toBeUndefined();
    expect(`${text}${meta.html}`).not.toMatch(
      /token=|contraseña:|código de activación/i,
    );

    expect(actions(audit)).toEqual([
      'STAFF_INVITED',
      'STAFF_INVITATION_EMAIL_SENT',
    ]);
    const sentDetail = audit.log.mock.calls[1][0].detail;
    expect(sentDetail).toMatchObject({
      invitedUserId: 'u-inv',
      channel: 'SMTP',
    });
    expect(JSON.stringify(sentDetail)).not.toMatch(/Entra con tu cuenta|<html/);
  });

  it('si el envío falla, la invitación queda creada, responde emailSent:false y audita el fallo', async () => {
    const { service, prisma, audit } = build();
    routeFindUnique(prisma, invitedUser());
    jest
      .spyOn(service as any, 'dispatchInstitutionalEmail')
      .mockRejectedValue(new ServiceUnavailableException('caído'));

    const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1', {
      role: RoleType.INSTITUTION_ADMIN,
    });
    expect(r).toEqual({
      emailSent: false,
      emailError: 'DELIVERY_REQUIRED_FAILED',
    });
    expect(actions(audit)).toEqual(['STAFF_INVITATION_EMAIL_FAILED']);
  });

  it('sin proveedor de correo configurado reporta NO_PROVIDER_CONFIGURED (no finge que se envió)', async () => {
    const { service, prisma } = build({ NODE_ENV: 'test' });
    routeFindUnique(prisma, invitedUser());
    const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1');
    expect(r).toEqual({
      emailSent: false,
      emailError: 'NO_PROVIDER_CONFIGURED',
    });
  });

  it('el correo para administrador o analista lleva el botón a /admin', async () => {
    const { service, prisma } = build();
    routeFindUnique(
      prisma,
      invitedUser({ roles: [{ role: RoleType.ANALYST }], professor: null }),
    );
    const dispatch = jest
      .spyOn(service as any, 'dispatchInstitutionalEmail')
      .mockResolvedValue({
        delivered: true,
        channel: 'WEBHOOK',
        errorCode: null,
      });
    await service.sendStaffInvitationEmail('u-inv', 'admin-1');
    const text = (dispatch.mock.calls[0] as any[])[2];
    expect(text).toContain('rol de Analista');
    expect(text).toContain('https://pumaia.example.mx/admin');
  });
});

describe('Fase 11 — Reenviar invitación', () => {
  it('solo INSTITUTION_ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, StaffController)).toEqual([
      RoleType.INSTITUTION_ADMIN,
    ]);
  });

  it('reenvía si sigue INVITED y marca resent en la bitácora', async () => {
    const { service, prisma, audit } = build();
    routeFindUnique(prisma, invitedUser());
    jest
      .spyOn(service as any, 'dispatchInstitutionalEmail')
      .mockResolvedValue({ delivered: true, channel: 'SMTP', errorCode: null });
    const r = await service.resendStaffInvitation('u-inv', 'admin-1');
    expect(r.emailSent).toBe(true);
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'STAFF_INVITATION_EMAIL_SENT',
      detail: expect.objectContaining({ resent: true }),
    });
  });

  it('rechaza con 409 si la persona ya está ACTIVE', async () => {
    const { service, prisma } = build();
    routeFindUnique(prisma, invitedUser({ status: UserStatus.ACTIVE }));
    await expect(
      service.resendStaffInvitation('u-inv', 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Fase 11 — Aceptar invitación con Google', () => {
  const googleProfile = {
    sub: 'google-sub-123',
    email: 'miniomcap@gmail.com',
    name: 'Mini Prueba',
    email_verified: true,
  };

  it('INVITED + email_verified: guarda googleSub, pasa a ACTIVE, registra lastLoginAt y audita STAFF_INVITATION_ACCEPTED', async () => {
    const { service, prisma, audit } = build();
    routeFindUnique(prisma, invitedUser());
    const res = await (service as any).processGoogleProfile(googleProfile);

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.status).toBe(UserStatus.ACTIVE);
    expect(data.googleSub).toBe('google-sub-123');
    expect(data.lastLoginAt).toBeInstanceOf(Date);
    expect(actions(audit)).toContain('STAFF_INVITATION_ACCEPTED');
    expect(res.user.roles).toEqual([RoleType.PROFESSOR]);
  });

  it('INVITED sin email_verified: 401 y no se activa', async () => {
    const { service, prisma, audit } = build();
    routeFindUnique(prisma, invitedUser());
    await expect(
      (service as any).processGoogleProfile({
        ...googleProfile,
        email_verified: false,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(actions(audit)).toContain(
      'STAFF_INVITATION_REJECTED_UNVERIFIED_EMAIL',
    );
  });

  it('correo no invitado y no institucional con número de cuenta: 401 como antes', async () => {
    const { service, prisma } = build();
    routeFindUnique(prisma, null);
    await expect(
      (service as any).processGoogleProfile({
        ...googleProfile,
        email: 'otra@gmail.com',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('un usuario ACTIVE con varios roles los recibe todos en la respuesta y no se audita aceptación', async () => {
    const { service, prisma, audit } = build();
    routeFindUnique(
      prisma,
      invitedUser({
        email: 'admin@acatlan.unam.mx',
        status: UserStatus.ACTIVE,
        googleSub: 'google-sub-123',
        roles: [{ role: RoleType.ANALYST }, { role: RoleType.PROFESSOR }],
      }),
    );
    const res = await (service as any).processGoogleProfile({
      ...googleProfile,
      email: 'admin@acatlan.unam.mx',
    });
    expect(res.user.roles).toEqual([RoleType.ANALYST, RoleType.PROFESSOR]);
    expect(actions(audit)).not.toContain('STAFF_INVITATION_ACCEPTED');
  });
});

describe('Fase 11 — Correo de invitación por el webhook de n8n', () => {
  const N8N = {
    N8N_EMAIL_WEBHOOK_URL: 'https://n8n.example.test/webhook/pumaia-email',
    N8N_EMAIL_WEBHOOK_API_KEY: 'clave-secreta-de-prueba',
  };
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  const respond = (status: number) =>
    fetchMock.mockResolvedValue({ status, ok: status >= 200 && status < 300 });

  it('2xx = enviado: POST con {from,to,subject,text,html}, cabecera X-Email-Api-Key y timeout', async () => {
    const { service, prisma, audit } = build(N8N);
    routeFindUnique(prisma, invitedUser());
    respond(200);

    const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1', {
      role: RoleType.PROFESSOR,
    });

    expect(r).toEqual({ emailSent: true, emailError: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(N8N.N8N_EMAIL_WEBHOOK_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Email-Api-Key']).toBe(N8N.N8N_EMAIL_WEBHOOK_API_KEY);
    expect(init.signal).toBeDefined();
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual([
      'from',
      'html',
      'subject',
      'text',
      'to',
    ]);
    expect(body.from).toBe('PumaIA · FES Acatlán');
    expect(body.to).toBe('miniomcap@gmail.com');
    expect(body.text).toMatch(/no lo respondas/);

    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'STAFF_INVITATION_EMAIL_SENT',
      detail: expect.objectContaining({ channel: 'WEBHOOK', httpStatus: 200 }),
    });
  });

  it.each([
    [401, 'WEBHOOK_HTTP_401'],
    [500, 'WEBHOOK_HTTP_500'],
    [302, 'WEBHOOK_HTTP_302'],
  ])(
    'respuesta %i = no enviado; audita el código HTTP sin la clave ni el contenido',
    async (status, code) => {
      const { service, prisma, audit } = build(N8N);
      routeFindUnique(prisma, invitedUser());
      respond(status);

      const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1');

      expect(r).toEqual({ emailSent: false, emailError: code });
      const entry = audit.log.mock.calls[0][0];
      expect(entry.action).toBe('STAFF_INVITATION_EMAIL_FAILED');
      expect(entry.detail).toMatchObject({
        httpStatus: status,
        errorCode: code,
      });
      const dump = JSON.stringify(entry);
      expect(dump).not.toContain(N8N.N8N_EMAIL_WEBHOOK_API_KEY);
      expect(dump).not.toContain(N8N.N8N_EMAIL_WEBHOOK_URL);
      expect(dump).not.toMatch(/Entra con tu cuenta|<html/);
    },
  );

  it('error de red y timeout = no enviado (WEBHOOK_NETWORK_ERROR / WEBHOOK_TIMEOUT)', async () => {
    const { service, prisma } = build(N8N);
    routeFindUnique(prisma, invitedUser());

    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('fetch failed'), { name: 'TypeError' }),
    );
    expect(await service.sendStaffInvitationEmail('u-inv', 'admin-1')).toEqual({
      emailSent: false,
      emailError: 'WEBHOOK_NETWORK_ERROR',
    });

    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
    );
    expect(await service.sendStaffInvitationEmail('u-inv', 'admin-1')).toEqual({
      emailSent: false,
      emailError: 'WEBHOOK_TIMEOUT',
    });
  });

  it.each([
    ['falta la clave', { N8N_EMAIL_WEBHOOK_URL: N8N.N8N_EMAIL_WEBHOOK_URL }],
    [
      'falta la URL',
      { N8N_EMAIL_WEBHOOK_API_KEY: N8N.N8N_EMAIL_WEBHOOK_API_KEY },
    ],
    [
      'solo variables viejas (ya no se leen)',
      { EMAIL_WEBHOOK_URL: 'https://x.test', EMAIL_WEBHOOK_API_KEY: 'k' },
    ],
  ])(
    '%s → NO_PROVIDER_CONFIGURED sin llamar al webhook',
    async (_label, cfg) => {
      const { service, prisma } = build(cfg as Record<string, string>);
      routeFindUnique(prisma, invitedUser());
      const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1');
      expect(r).toEqual({
        emailSent: false,
        emailError: 'NO_PROVIDER_CONFIGURED',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('producción: el SMTP hecho a mano está desactivado y la invitación no lanza aunque no haya proveedor', async () => {
    const { service, prisma } = build({
      NODE_ENV: 'production',
      SMTP_HOST: '127.0.0.1',
    });
    routeFindUnique(prisma, invitedUser());
    const smtp = jest.spyOn(service as any, 'sendViaSmtp');
    const r = await service.sendStaffInvitationEmail('u-inv', 'admin-1');
    expect(smtp).not.toHaveBeenCalled();
    expect(r).toEqual({
      emailSent: false,
      emailError: 'NO_PROVIDER_CONFIGURED',
    });
  });

  it('con webhook configurado se usa n8n aunque haya SMTP de pruebas', async () => {
    const { service, prisma } = build({ ...N8N, SMTP_HOST: '127.0.0.1' });
    routeFindUnique(prisma, invitedUser());
    const smtp = jest.spyOn(service as any, 'sendViaSmtp');
    respond(200);
    await service.sendStaffInvitationEmail('u-inv', 'admin-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(smtp).not.toHaveBeenCalled();
  });

  it('el reenvío usa el mismo canal', async () => {
    const { service, prisma, audit } = build(N8N);
    routeFindUnique(prisma, invitedUser());
    respond(401);
    const r = await service.resendStaffInvitation('u-inv', 'admin-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.emailSent).toBe(false);
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'STAFF_INVITATION_EMAIL_FAILED',
      detail: expect.objectContaining({ httpStatus: 401, resent: true }),
    });
  });
});
