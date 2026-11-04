import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import {
  SessionStatus,
  AttendanceStatus,
  AttendanceMethod,
  RoleType,
} from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceService {
  /** Ventana de rotación del código QR dinámico (25 segundos, dentro del rango requerido de 20 a 30s) */
  public static readonly QR_WINDOW_SECONDS = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async resolveProfessorId(user?: AuthUser): Promise<string | null> {
    if (!user) return null;
    if (user.professorId) return user.professorId;
    if (typeof (this.prisma as any).professor?.findUnique === 'function') {
      const prof = await (this.prisma as any).professor.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      return prof?.id ?? null;
    }
    return null;
  }

  /**
   * Valida que el usuario sea administrador institucional o el profesor titular asignado al grupo (`section.professorId`).
   */
  private async assertSectionOwnership(
    section: { id?: string; professorId?: string | null } | null | undefined,
    user?: AuthUser,
  ): Promise<void> {
    if (!user) return;
    if (user.roles?.includes(RoleType.INSTITUTION_ADMIN)) {
      return;
    }

    if (!user.roles?.includes(RoleType.PROFESSOR)) {
      throw new ForbiddenException(
        'Solo el profesor titular del grupo o un administrador institucional puede ejecutar esta operación.',
      );
    }

    const profId = await this.resolveProfessorId(user);
    if (!profId || !section?.professorId || section.professorId !== profId) {
      throw new ForbiddenException(
        'No eres el profesor titular asignado a este grupo académico.',
      );
    }
  }

  /**
   * Calcula el token QR efímero para un paso temporal de 25 segundos.
   */
  public computeQrTokenForStep(sessionSecret: string, step: number): string {
    const hmac = crypto
      .createHmac('sha256', sessionSecret.trim())
      .update(`PUMAIA_QR_STEP:${step}`)
      .digest('hex')
      .substring(0, 10)
      .toUpperCase();
    return `QR-${hmac}`;
  }

  /**
   * Genera el token QR dinámico vigente para una semilla de sesión y marca temporal dada.
   */
  public generateDynamicQrToken(
    sessionSecret: string,
    timestampMs: number = Date.now(),
  ): {
    qrToken: string;
    expiresAt: string;
    windowSeconds: number;
    step: number;
  } {
    const windowMs = AttendanceService.QR_WINDOW_SECONDS * 1000;
    const step = Math.floor(timestampMs / windowMs);
    const qrToken = this.computeQrTokenForStep(sessionSecret, step);
    const expiresAt = new Date((step + 1) * windowMs).toISOString();

    return {
      qrToken,
      expiresAt,
      windowSeconds: AttendanceService.QR_WINDOW_SECONDS,
      step,
    };
  }

  /**
   * Verifica si el token QR proporcionado pertenece a la ventana temporal vigente (o inmediata anterior por latencia de red).
   * Rechaza secretos estáticos de sesión y tokens de ventanas expiradas.
   */
  public isDynamicQrTokenValid(
    sessionSecret: string,
    candidateToken: string,
    nowMs: number = Date.now(),
  ): boolean {
    const cleanCandidate = (candidateToken || '').trim().toUpperCase();
    if (!cleanCandidate.startsWith('QR-')) {
      return false;
    }

    const windowMs = AttendanceService.QR_WINDOW_SECONDS * 1000;
    const currentStep = Math.floor(nowMs / windowMs);

    const validCurrent = this.computeQrTokenForStep(sessionSecret, currentStep);
    const validPrevious = this.computeQrTokenForStep(
      sessionSecret,
      currentStep - 1,
    );

    return cleanCandidate === validCurrent || cleanCandidate === validPrevious;
  }

  /**
   * Abre una nueva sesión de clase generando una semilla secreta y devolviendo el primer token QR dinámico.
   */
  async openSession(
    sectionId: string,
    openedByUserId: string,
    user?: AuthUser,
  ) {
    const section = await this.prisma.courseSection.findUnique({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException('Grupo no encontrado.');
    }

    await this.assertSectionOwnership(section, user);

    const existingOpen = await this.prisma.classSession.findFirst({
      where: {
        sectionId,
        status: SessionStatus.OPEN,
      },
    });

    if (existingOpen) {
      const dynamic = this.generateDynamicQrToken(existingOpen.secret);
      return {
        ...existingOpen,
        qrToken: dynamic.qrToken,
        qrExpiresAt: dynamic.expiresAt,
        qrWindowSeconds: dynamic.windowSeconds,
      };
    }

    const secret = crypto.randomBytes(16).toString('hex').toUpperCase();

    const created = await this.prisma.classSession.create({
      data: {
        sectionId,
        openedBy: openedByUserId,
        startsAt: new Date(),
        status: SessionStatus.OPEN,
        secret,
      },
      include: {
        section: {
          include: { subject: true },
        },
      },
    });

    const dynamic = this.generateDynamicQrToken(created.secret || secret);
    return {
      ...created,
      qrToken: dynamic.qrToken,
      qrExpiresAt: dynamic.expiresAt,
      qrWindowSeconds: dynamic.windowSeconds,
    };
  }

  /**
   * Obtiene el token QR dinámico actual (rotación cada 25s) para proyectar en el aula.
   * Exclusivo para el profesor titular del grupo o un administrador institucional.
   */
  async getSessionQrToken(sessionId: string, user?: AuthUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { section: true },
    });

    if (!session) {
      throw new NotFoundException('Sesión de clase no encontrada.');
    }

    if (session.section) {
      await this.assertSectionOwnership(session.section, user);
    }

    if (session.status !== SessionStatus.OPEN) {
      throw new BadRequestException(
        'La sesión de clase está cerrada; no se pueden emitir códigos QR.',
      );
    }

    const dynamic = this.generateDynamicQrToken(session.secret);
    return {
      sessionId: session.id,
      sectionId: session.sectionId,
      qrToken: dynamic.qrToken,
      expiresAt: dynamic.expiresAt,
      windowSeconds: dynamic.windowSeconds,
    };
  }

  /**
   * Registra la asistencia del alumno autenticado validando el token QR dinámico vigente
   * e impidiendo registros duplicados en la misma sesión.
   */
  async markAttendance(studentId: string, dto: MarkAttendanceDto) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: dto.sessionId },
      include: { section: true },
    });

    if (!session) {
      throw new NotFoundException('Sesión de clase no encontrada.');
    }

    if (session.status !== SessionStatus.OPEN) {
      throw new BadRequestException('Esta sesión de clase ya ha sido cerrada.');
    }

    if (!this.isDynamicQrTokenValid(session.secret, dto.secret)) {
      throw new ForbiddenException(
        'El código QR de asistencia es inválido o ha expirado. Escanea el código QR vigente proyectado por tu profesor.',
      );
    }

    // Verificar que el estudiante esté registrado en el grupo (vía Enrollment o SectionRoster)
    const isEnrolled = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        sectionId: session.sectionId,
      },
    });

    const isInRoster = await this.prisma.sectionRoster.findFirst({
      where: {
        sectionId: session.sectionId,
        linkedStudentId: studentId,
      },
    });

    if (!isEnrolled && !isInRoster) {
      throw new ForbiddenException('No estás inscrito en este grupo académico.');
    }

    // Impedir registro duplicado de asistencia en la misma sesión
    if (typeof (this.prisma.attendanceRecord as any)?.findUnique === 'function') {
      const existingRecord = await this.prisma.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId,
          },
        },
      });

      if (existingRecord) {
        throw new ConflictException(
          'Ya has registrado tu asistencia en esta sesión de clase.',
        );
      }
    }

    if (typeof (this.prisma.attendanceRecord as any)?.create === 'function') {
      return this.prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId,
          status: AttendanceStatus.PRESENT,
          method: AttendanceMethod.QR,
          markedAt: new Date(),
        },
      });
    }

    return this.prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId,
        },
      },
      update: {
        status: AttendanceStatus.PRESENT,
        method: AttendanceMethod.QR,
        markedAt: new Date(),
      },
      create: {
        sessionId: session.id,
        studentId,
        status: AttendanceStatus.PRESENT,
        method: AttendanceMethod.QR,
        markedAt: new Date(),
      },
    });
  }

  /**
   * Cierra la sesión de clase y genera ausencias automáticas para los alumnos no registrados.
   * Valida que el profesor sea el titular del grupo.
   */
  async closeSession(sessionId: string, user?: AuthUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        section: {
          include: {
            roster: true,
            enrollments: true,
          },
        },
        records: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión no encontrada.');
    }

    await this.assertSectionOwnership(session.section, user);

    if (session.status === SessionStatus.CLOSED) {
      return session;
    }

    return this.prisma.$transaction(async (tx) => {
      const closedSession = await tx.classSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.CLOSED,
          closesAt: new Date(),
        },
      });

      const enrolledStudentIds = new Set<string>();
      session.section.enrollments.forEach((e) =>
        enrolledStudentIds.add(e.studentId),
      );
      session.section.roster.forEach((r) => {
        if (r.linkedStudentId) enrolledStudentIds.add(r.linkedStudentId);
      });

      const recordedStudentIds = new Set(
        session.records.map((r) => r.studentId),
      );

      for (const stId of enrolledStudentIds) {
        if (!recordedStudentIds.has(stId)) {
          await tx.attendanceRecord.create({
            data: {
              sessionId,
              studentId: stId,
              status: AttendanceStatus.ABSENT,
              method: AttendanceMethod.MANUAL,
              markedAt: new Date(),
            },
          });
        }
      }

      return closedSession;
    });
  }

  /**
   * Corrección manual de asistencia por parte del profesor titular o administrador (auditada).
   */
  async manualOverride(
    recordId: string,
    dto: UpdateAttendanceDto,
    modifiedByUserId: string,
    user?: AuthUser,
  ) {
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        student: true,
        session: {
          include: { section: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Registro de asistencia no encontrado.');
    }

    if (user) {
      let section = (existing.session as any)?.section;
      if (
        !section &&
        existing.session?.sectionId &&
        typeof (this.prisma.courseSection as any)?.findUnique === 'function'
      ) {
        section = await this.prisma.courseSection.findUnique({
          where: { id: existing.session.sectionId },
        });
      }
      await this.assertSectionOwnership(section, user);
    }

    const previousStatus = existing.status;

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status: dto.status,
        markedBy: modifiedByUserId,
      },
    });

    await this.auditService.log({
      actorType: user?.roles?.includes(RoleType.INSTITUTION_ADMIN)
        ? 'ADMIN'
        : user?.roles?.includes(RoleType.PROFESSOR)
          ? 'PROFESSOR'
          : 'ADMIN',
      actorId: modifiedByUserId,
      action: 'ATTENDANCE_MANUAL_OVERRIDE',
      detail: {
        recordId,
        studentId: existing.studentId,
        sessionId: existing.sessionId,
        previousStatus,
        newStatus: dto.status,
        reason: dto.reason || 'Sin justificación declarada',
      },
    });

    return updated;
  }

  /**
   * Consulta el historial de asistencia del estudiante autenticado.
   */
  async getMyAttendance(studentId: string, sectionId?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        ...(sectionId && {
          session: { sectionId },
        }),
      },
      include: {
        session: {
          include: {
            section: {
              include: { subject: true },
            },
          },
        },
      },
      orderBy: { markedAt: 'desc' },
    });
  }

  /**
   * Consulta los registros de asistencia de una sesión de clase (valida titularidad del profesor).
   */
  async getSessionRecords(sessionId: string, user?: AuthUser) {
    if (user && typeof (this.prisma.classSession as any)?.findUnique === 'function') {
      const session = await this.prisma.classSession.findUnique({
        where: { id: sessionId },
        include: { section: true },
      });

      if (!session) {
        throw new NotFoundException('Sesión de clase no encontrada.');
      }

      await this.assertSectionOwnership(session.section, user);
    }

    return this.prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                lastNameP: true,
                lastNameM: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { markedAt: 'asc' },
    });
  }
}
