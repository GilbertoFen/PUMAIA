import { RoleType, UserStatus } from '@prisma/client';
import { ValidationPipe } from '@nestjs/common';
import {
  StaffService,
  STAFF_ROLES,
} from '../autenticacion/staff/staff.service';
import { StaffController } from '../autenticacion/staff/staff.controller';
import { ReportsController } from '../metrics/reports/reports.controller';
import { GenerateReportDto } from '../metrics/reports/reports.dto';
import { MetricsService } from '../metrics/metrics.service';
import { DashboardService } from '../metrics/dashboard.service';
import { DashboardController } from '../metrics/dashboard.controller';
import { LabelingController } from '../metrics/labeling/labeling.controller';
import { ROLES_KEY } from '../autenticacion/decorators/roles.decorator';

const admin = {
  userId: 'admin-1',
  name: 'Ana Admin',
  email: 'ana@acatlan.unam.mx',
  roles: [RoleType.INSTITUTION_ADMIN],
  studentId: null,
  accountNumber: null,
} as any;

describe('Panel admin — roles por controlador', () => {
  it('personal: solo INSTITUTION_ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, StaffController)).toEqual([
      RoleType.INSTITUTION_ADMIN,
    ]);
  });
  it('reportes y dashboard: INSTITUTION_ADMIN y ANALYST', () => {
    const both = [RoleType.INSTITUTION_ADMIN, RoleType.ANALYST];
    expect(Reflect.getMetadata(ROLES_KEY, ReportsController)).toEqual(both);
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController)).toEqual(both);
  });
  it('etiquetado: solo ANALYST', () => {
    expect(Reflect.getMetadata(ROLES_KEY, LabelingController)).toEqual([
      RoleType.ANALYST,
    ]);
  });
});

describe('Panel admin — Personal', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: StaffService;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn() },
      professor: { findMany: jest.fn().mockResolvedValue([]) },
    };
    audit = { log: jest.fn() };
    service = new StaffService(prisma, audit as any);
  });

  it('lista solo personal no eliminado, oculta el rol STUDENT y audita', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'prof@acatlan.unam.mx',
        name: 'Pat',
        lastNameP: 'Pérez',
        lastNameM: null,
        status: UserStatus.INVITED,
        createdAt: new Date('2026-10-01'),
        lastLoginAt: null,
        roles: [
          { role: RoleType.STUDENT, grantedAt: new Date('2026-09-01') },
          { role: RoleType.PROFESSOR, grantedAt: new Date('2026-10-01') },
        ],
        professor: { id: 'p1' },
      },
    ]);
    const rows = await service.list('admin-1');
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      deletedAt: null,
      status: { not: UserStatus.DELETED },
      roles: { some: { role: { in: STAFF_ROLES } } },
    });
    expect(rows[0].roles).toEqual([RoleType.PROFESSOR]);
    expect(rows[0].invitedAt).toEqual(new Date('2026-10-01'));
    expect(rows[0].status).toBe(UserStatus.INVITED);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STAFF_LIST_VIEWED',
        actorId: 'admin-1',
      }),
    );
  });

  it('busca solo profesores activos sin cuenta y audita la búsqueda', async () => {
    await service.professorsWithoutAccount('admin-1', '  gar ');
    const args = prisma.professor.findMany.mock.calls[0][0];
    expect(args.where.userId).toBeNull();
    expect(args.where.active).toBe(true);
    expect(args.where.OR[1]).toEqual({
      lastNameP: { contains: 'gar', mode: 'insensitive' },
    });
    expect(args.take).toBe(20);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STAFF_PROFESSORS_SEARCHED',
        detail: { q: 'gar', results: 0 },
      }),
    );
  });
});

describe('Panel admin — Reportes', () => {
  it('registra REPORT_GENERATED con sección, filtros y usuario, y devuelve quién lo generó', async () => {
    const audit = { log: jest.fn() };
    const metrics = { minGroup: 5 } as any;
    const ctrl = new ReportsController(audit as any, metrics);
    const res = await ctrl.generate(
      { section: 'attendance', weeks: 8 } as GenerateReportDto,
      admin,
    );
    expect(audit.log).toHaveBeenCalledWith({
      actorType: 'ADMIN',
      actorId: 'admin-1',
      action: 'REPORT_GENERATED',
      detail: expect.objectContaining({
        section: 'attendance',
        filters: { periodId: null, weeks: 8, kind: null },
        minGroupSize: 5,
      }),
    });
    expect(res.generatedBy).toEqual({
      name: 'Ana Admin',
      email: 'ana@acatlan.unam.mx',
    });
    expect(res.minGroupSize).toBe(5);
  });

  it('rechaza secciones no imprimibles (el etiquetado nunca se imprime)', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    await expect(
      pipe.transform(
        { section: 'labeling' },
        { type: 'body', metatype: GenerateReportDto },
      ),
    ).rejects.toBeDefined();
  });
});

describe('Panel admin — Periodos', () => {
  it('devuelve los periodos y marca el que está en curso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-08T18:00:00Z'));
    const prisma: any = {
      academicPeriod: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p2',
            code: '2027-1',
            startsAt: new Date('2027-01-20'),
            endsAt: new Date('2027-06-01'),
          },
          {
            id: 'p1',
            code: '2026-2',
            startsAt: new Date('2026-08-01'),
            endsAt: new Date('2026-12-15'),
          },
        ]),
      },
    };
    const metrics = new MetricsService(prisma, { get: () => '3' } as any);
    const res = await new DashboardService(prisma, metrics).periods();
    expect(res.minGroupSize).toBe(3);
    expect(res.items.map((p: any) => [p.code, p.current])).toEqual([
      ['2027-1', false],
      ['2026-2', true],
    ]);
    jest.useRealTimers();
  });
});
