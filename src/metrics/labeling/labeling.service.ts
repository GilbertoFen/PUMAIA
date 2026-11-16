import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConsentKind, LabelSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { getConsentStates, usersWithState } from '../metrics.utils';

const DEFAULT_QUEUE_SIZE = 20;

/**
 * Etiquetado manual de temas por el equipo (piloto; después lo hará un modelo).
 * Solo conversaciones NO sensibles de alumnos con ANALYTICS vigente.
 * Nunca se expone nombre, correo ni número de cuenta del alumno. Todo se audita.
 */
@Injectable()
export class LabelingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async eligibleWhere() {
    const { states } = await getConsentStates(
      this.prisma,
      ConsentKind.ANALYTICS,
    );
    return {
      sensitive: false,
      student: { userId: { in: usersWithState(states, 'CURRENT') } },
    };
  }

  /** Catálogo de temas activos para elegir. */
  topics() {
    return this.prisma.topicCategory.findMany({
      where: { active: true },
      select: { id: true, code: true, label: true, topicGroup: true },
      orderBy: [{ topicGroup: 'asc' }, { label: 'asc' }],
    });
  }

  /** Conversaciones elegibles sin etiqueta manual, de la más antigua a la más reciente. */
  async queue(actorId: string, limit = DEFAULT_QUEUE_SIZE) {
    const skipped = await this.skippedBy(actorId);
    const where = {
      ...(await this.eligibleWhere()),
      labels: { none: { source: LabelSource.MANUAL } },
      ...(skipped.length > 0 && { id: { notIn: skipped } }),
    };
    const [pending, conversations] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
        // Sin datos que identifiquen al alumno: ni nombre, correo, cuenta, grupo ni semestre.
        select: {
          id: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { role: true, content: true, createdAt: true },
          },
        },
      }),
    ]);

    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'LABELING_VIEWED',
      detail: { conversationIds: conversations.map((c) => c.id), pending },
    });

    return { pending, conversations };
  }

  /** Agrega etiquetas MANUAL (idempotente: repetir un tema no duplica). */
  async addLabels(actorId: string, conversationId: string, topicIds: string[]) {
    await this.assertEligible(conversationId);

    const topics = await this.prisma.topicCategory.findMany({
      where: { id: { in: topicIds }, active: true },
      select: { id: true, code: true },
    });
    if (topics.length !== topicIds.length) {
      throw new BadRequestException('Algún tema no existe o está inactivo.');
    }

    await this.prisma.$transaction(
      topics.map((t) =>
        this.prisma.conversationLabel.upsert({
          where: {
            conversationId_source_topicId: {
              conversationId,
              source: LabelSource.MANUAL,
              topicId: t.id,
            },
          },
          update: {},
          create: { conversationId, topicId: t.id, source: LabelSource.MANUAL },
        }),
      ),
    );

    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'LABEL_ADDED',
      detail: { conversationId, topicCodes: topics.map((t) => t.code) },
    });

    return this.labelsOf(conversationId);
  }

  /** Quita una etiqueta MANUAL puesta por error. */
  async removeLabel(actorId: string, conversationId: string, topicId: string) {
    const { count } = await this.prisma.conversationLabel.deleteMany({
      where: { conversationId, topicId, source: LabelSource.MANUAL },
    });
    if (count === 0) throw new NotFoundException('La etiqueta no existe.');

    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'LABEL_REMOVED',
      detail: { conversationId, topicId },
    });

    return this.labelsOf(conversationId);
  }

  /**
   * El analista reconoce a la persona por el contenido: no la etiqueta y no se le vuelve a mostrar.
   * Queda en la bitácora (sin el contenido) para que otra persona del equipo la etiquete.
   */
  async skip(actorId: string, conversationId: string) {
    const exists = await this.prisma.conversation.count({
      where: { id: conversationId },
    });
    if (!exists) throw new NotFoundException('Conversación no encontrada.');
    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'LABEL_SKIPPED_RECOGNIZED',
      detail: { conversationId },
    });
    return { skipped: true, conversationId };
  }

  /** Conversaciones que este analista ya saltó por reconocer a la persona. */
  private async skippedBy(actorId: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { actorId, action: 'LABEL_SKIPPED_RECOGNIZED' },
      select: { detail: true },
    });
    return rows
      .map(
        (r) =>
          (r.detail as { conversationId?: unknown } | null)?.conversationId,
      )
      .filter((id): id is string => typeof id === 'string');
  }

  private labelsOf(conversationId: string) {
    return this.prisma.conversationLabel.findMany({
      where: { conversationId, source: LabelSource.MANUAL },
      select: {
        topic: {
          select: { id: true, code: true, label: true, topicGroup: true },
        },
      },
    });
  }

  private async assertEligible(conversationId: string) {
    const exists = await this.prisma.conversation.count({
      where: { id: conversationId },
    });
    if (!exists) throw new NotFoundException('Conversación no encontrada.');
    const eligible = await this.prisma.conversation.count({
      where: { id: conversationId, ...(await this.eligibleWhere()) },
    });
    if (!eligible) {
      throw new ForbiddenException(
        'La conversación es sensible o el alumno no tiene ANALYTICS vigente: no se puede etiquetar.',
      );
    }
  }
}
