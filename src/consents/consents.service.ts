import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentKind } from '@prisma/client';
import { RecordConsentDto } from './dto/record-consent.dto';
import { AuditService } from '../audit/audit.service';

const DEFAULT_NOTICE_CONTENT: Record<ConsentKind, { version: string; content: string }> = {
  [ConsentKind.TERMS_AND_NOTICE]: {
    version: '1.0',
    content:
      'Términos de Uso y Aviso de Privacidad Integral de PUMAIA (FES Acatlán, UNAM). El tratamiento de datos académicos y de orientación se realiza exclusivamente con fines educativos e institucionales.',
  },
  [ConsentKind.ANALYTICS]: {
    version: '1.0',
    content:
      'Consentimiento opcional para analítica institucional agregada y protegida mediante k-anonimato (mínimo 10 alumnos únicos por cohorte). Excluye conversaciones sensibles.',
  },
  [ConsentKind.IMPROVEMENT]: {
    version: '1.0',
    content:
      'Consentimiento opcional para mejora continua de los modelos y respuestas del asistente académico PUMAIA, excluyendo conversaciones marcadas como sensibles.',
  },
};

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async ensureNoticeForKind(kind: ConsentKind) {
    let notice = await this.prisma.privacyNotice.findFirst({
      where: { kind },
      orderBy: { publishedAt: 'desc' },
    });

    if (!notice && typeof (this.prisma.privacyNotice as any)?.create === 'function') {
      const def = DEFAULT_NOTICE_CONTENT[kind];
      try {
        notice = await this.prisma.privacyNotice.create({
          data: {
            kind,
            version: def.version,
            text: def.content,
            publishedAt: new Date(),
          },
        });
      } catch {
        notice = await this.prisma.privacyNotice.findFirst({
          where: { kind },
          orderBy: { publishedAt: 'desc' },
        });
      }
    }

    return notice;
  }

  /**
   * Obtiene la versión vigente (más reciente por fecha de publicación) de cada tipo de aviso.
   * Si no existen avisos iniciales en la base de datos, inicializa la versión 1.0 por defecto.
   */
  async getActivePrivacyNotices() {
    const kinds = [
      ConsentKind.TERMS_AND_NOTICE,
      ConsentKind.ANALYTICS,
      ConsentKind.IMPROVEMENT,
    ];

    const notices = await Promise.all(
      kinds.map((kind) => this.ensureNoticeForKind(kind)),
    );

    return notices.filter((n): n is NonNullable<typeof n> => n !== null);
  }

  /**
   * Obtiene el aviso vigente de un tipo específico.
   */
  async getActiveNoticeByKind(kind: ConsentKind) {
    const notice = await this.ensureNoticeForKind(kind);

    if (!notice) {
      throw new NotFoundException(
        `No existe un aviso de privacidad publicado para el tipo ${kind}`,
      );
    }

    return notice;
  }

  /**
   * Registra un nuevo evento de consentimiento (append-only).
   * Nunca actualiza ni elimina registros pasados.
   */
  async recordConsent(userId: string, dto: RecordConsentDto) {
    const notice = await this.prisma.privacyNotice.findUnique({
      where: { id: dto.noticeId },
    });

    if (!notice) {
      throw new NotFoundException(
        `El aviso de privacidad con ID ${dto.noticeId} no existe`,
      );
    }

    if (notice.kind !== dto.kind) {
      throw new BadRequestException(
        `El tipo del aviso (${notice.kind}) no coincide con el tipo solicitado (${dto.kind})`,
      );
    }

    const record = await this.prisma.consentRecord.create({
      data: {
        userId,
        noticeId: dto.noticeId,
        kind: dto.kind,
        granted: dto.granted,
      },
    });

    await this.auditService.log({
      actorType: 'STUDENT',
      actorId: userId,
      action: dto.granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      detail: {
        kind: dto.kind,
        noticeId: dto.noticeId,
        version: notice.version,
      },
    });

    return record;
  }

  /**
   * Registra en lote los consentimientos (ejemplo: durante el onboarding o login).
   * Operación atómica mediante transacción: valida todos los avisos antes de insertar.
   */
  async recordBatchConsents(userId: string, consents: RecordConsentDto[]) {
    if (!consents || consents.length === 0) {
      throw new BadRequestException(
        'El lote de consentimientos no puede estar vacío.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const records: any[] = [];

      for (const consent of consents) {
        const notice = await tx.privacyNotice.findUnique({
          where: { id: consent.noticeId },
        });

        if (!notice) {
          throw new NotFoundException(
            `El aviso de privacidad con ID ${consent.noticeId} no existe.`,
          );
        }

        if (notice.kind !== consent.kind) {
          throw new BadRequestException(
            `El tipo del aviso (${notice.kind}) no coincide con el tipo solicitado (${consent.kind}) para ${notice.id}`,
          );
        }

        const newRecord = await tx.consentRecord.create({
          data: {
            userId,
            noticeId: consent.noticeId,
            kind: consent.kind,
            granted: consent.granted,
          },
        });

        records.push(newRecord);
      }

      await this.auditService.log({
        actorType: 'STUDENT',
        actorId: userId,
        action: 'CONSENTS_BATCH_RECORDED',
        detail: {
          count: records.length,
          items: consents.map((c) => ({ kind: c.kind, granted: c.granted })),
        },
      });

      return records;
    });
  }

  /**
   * Consulta el estado de consentimientos vigentes de un usuario.
   * Por cada ConsentKind, busca el registro más reciente.
   */
  async getUserConsentStatus(userId: string) {
    const kinds = [
      ConsentKind.TERMS_AND_NOTICE,
      ConsentKind.ANALYTICS,
      ConsentKind.IMPROVEMENT,
    ];

    const statusList = await Promise.all(
      kinds.map(async (kind) => {
        const latestRecord = await this.prisma.consentRecord.findFirst({
          where: { userId, kind },
          orderBy: { createdAt: 'desc' },
          include: { notice: true },
        });

        const activeNotice = await this.ensureNoticeForKind(kind);

        const isUpToDate =
          latestRecord &&
          activeNotice &&
          latestRecord.noticeId === activeNotice.id &&
          latestRecord.granted;

        return {
          kind,
          noticeId: activeNotice?.id ?? null,
          granted: latestRecord ? latestRecord.granted : false,
          recordId: latestRecord?.id ?? null,
          recordedAt: latestRecord?.createdAt ?? null,
          versionAccepted: latestRecord?.notice?.version ?? null,
          activeVersion: activeNotice?.version ?? null,
          needsUpdate: !isUpToDate,
        };
      }),
    );

    return statusList;
  }

  /**
   * Consulta el historial completo e inmutable de consentimientos de un usuario.
   */
  async getUserConsentHistory(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        notice: {
          select: { version: true, kind: true, publishedAt: true },
        },
      },
    });
  }

  /**
   * Verifica si un usuario tiene aceptado y vigente un consentimiento específico.
   */
  async hasValidConsent(userId: string, kind: ConsentKind): Promise<boolean> {
    const activeNotice = await this.getActiveNoticeByKind(kind).catch(
      () => null,
    );
    if (!activeNotice) return false;

    const latest = await this.prisma.consentRecord.findFirst({
      where: { userId, kind },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) return false;

    return latest.granted && latest.noticeId === activeNotice.id;
  }
}
