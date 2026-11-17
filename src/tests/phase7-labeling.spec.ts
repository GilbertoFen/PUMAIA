import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConsentKind, LabelSource } from '@prisma/client';
import { MetricsModule } from '../metrics/metrics.module';
import { LabelingService } from '../metrics/labeling/labeling.service';
import { DashboardController } from '../metrics/dashboard.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditModule } from '../audit/audit.module';

function makePrisma() {
  return {
    privacyNotice: {
      findFirst: jest.fn().mockResolvedValue({ id: 'a2', version: '1.0' }),
    },
    consentRecord: {
      findMany: jest.fn().mockResolvedValue([
        {
          kind: ConsentKind.ANALYTICS,
          userId: 'u1',
          granted: true,
          noticeId: 'a2',
        },
      ]),
    },
    conversation: {
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    topicCategory: { findMany: jest.fn() },
    conversationLabel: {
      upsert: jest.fn((args) => args),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops) => Promise.resolve(ops)),
  } as any;
}

describe('Fase 7 — Etiquetado manual de temas', () => {
  let prisma: any;
  let audit: { log: jest.Mock };
  let service: LabelingService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = { log: jest.fn() };
    service = new LabelingService(prisma, audit as any);
  });

  it('la cola solo trae conversaciones no sensibles, con ANALYTICS vigente y sin etiqueta manual, sin datos del alumno', async () => {
    prisma.conversation.count.mockResolvedValue(1);
    await service.queue('analyst-1', 5);
    const args = prisma.conversation.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      sensitive: false,
      student: { userId: { in: ['u1'] } },
      labels: { none: { source: LabelSource.MANUAL } },
    });
    expect(args.take).toBe(5);
    expect(Object.keys(args.select)).toEqual(['id', 'createdAt', 'messages']);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LABELING_VIEWED',
        actorId: 'analyst-1',
      }),
    );
  });

  it('saltar por reconocer a la persona se audita y excluye la conversación de la cola de ese analista', async () => {
    prisma.conversation.count.mockResolvedValue(1);
    await service.skip('analyst-1', 'c9');
    expect(audit.log).toHaveBeenCalledWith({
      actorType: 'ADMIN',
      actorId: 'analyst-1',
      action: 'LABEL_SKIPPED_RECOGNIZED',
      detail: { conversationId: 'c9' },
    });

    prisma.auditLog.findMany.mockResolvedValue([
      { detail: { conversationId: 'c9' } },
    ]);
    await service.queue('analyst-1', 5);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { actorId: 'analyst-1', action: 'LABEL_SKIPPED_RECOGNIZED' },
      select: { detail: true },
    });
    const args = prisma.conversation.findMany.mock.calls[0][0];
    expect(args.where.id).toEqual({ notIn: ['c9'] });
  });

  it('rechaza etiquetar una conversación sensible o sin ANALYTICS vigente', async () => {
    prisma.conversation.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(service.addLabels('a', 'c1', ['t1'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.conversationLabel.upsert).not.toHaveBeenCalled();
  });

  it('rechaza temas inexistentes o inactivos', async () => {
    prisma.conversation.count.mockResolvedValue(1);
    prisma.topicCategory.findMany.mockResolvedValue([
      { id: 't1', code: 'BECAS' },
    ]);
    await expect(
      service.addLabels('a', 'c1', ['t1', 't2']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda etiquetas MANUAL idempotentes y audita', async () => {
    prisma.conversation.count.mockResolvedValue(1);
    prisma.topicCategory.findMany.mockResolvedValue([
      { id: 't1', code: 'BECAS' },
    ]);
    await service.addLabels('a', 'c1', ['t1']);
    expect(prisma.conversationLabel.upsert).toHaveBeenCalledWith({
      where: {
        conversationId_source_topicId: {
          conversationId: 'c1',
          source: LabelSource.MANUAL,
          topicId: 't1',
        },
      },
      update: {},
      create: {
        conversationId: 'c1',
        topicId: 't1',
        source: LabelSource.MANUAL,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LABEL_ADDED',
        detail: { conversationId: 'c1', topicCodes: ['BECAS'] },
      }),
    );
  });
});

describe('Fase 7 — MetricsModule arranca con sus dependencias', () => {
  it('resuelve DashboardController y LabelingService', async () => {
    const moduleRef = await Test.createTestingModule({
      // Igual que AppModule: ConfigModule y AuditModule son globales.
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AuditModule,
        MetricsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(makePrisma())
      .overrideProvider(AuditService)
      .useValue({ log: jest.fn() })
      .compile();
    expect(moduleRef.get(DashboardController)).toBeDefined();
    expect(moduleRef.get(LabelingService)).toBeDefined();
  });
});
