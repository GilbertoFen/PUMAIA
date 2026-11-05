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
  EnrollmentStatus,
} from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import * as crypto from 'crypto';

@Injectable()
export class AttendanceService {
  /** Ventana de rotación del código QR dinámico (25 segundos, dentro del rango requerido de 20 a 30s) */
  public static readonly QR_WINDOW_SECONDS = 25;

  /** Secciones con horario simulado activo para pruebas de desarrollo */
  private readonly simulatedSections = new Set<string>();

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
   * Determina si la sección se encuentra dentro de su horario lectivo configurado
   * o si cuenta con simulación activa en el backend para pruebas.
   */
  async isSectionInClassTime(sectionId: string): Promise<{
    inSchedule: boolean;
    isSimulated: boolean;
    meetings: any[];
  }> {
    const isSimulated = this.simulatedSections.has(sectionId);

    const section = await this.prisma.courseSection.findUnique({
      where: { id: sectionId },
      include: {
        meetings: {
          orderBy: { weekday: 'asc' },
        },
      },
    });

    if (!section) {
      throw new NotFoundException('Grupo no encontrado.');
    }

    if (isSimulated) {
      return {
        inSchedule: true,
        isSimulated: true,
        meetings: section.meetings,
      };
    }

    // Calcular día de la semana y hora actual en zona horaria Ciudad de México (America/Mexico_City)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value;
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minuteStr = parts.find((p) => p.type === 'minute')?.value || '00';

    const weekdayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const currentWeekday = weekdayMap[weekdayStr || ''] || 1;
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

    const match = (section.meetings || []).some((m) => {
      if (m.weekday !== currentWeekday) return false;
      const startD = new Date(m.startTime);
      const endD = new Date(m.endTime);
      const startMin = startD.getUTCHours() * 60 + startD.getUTCMinutes();
      const endMin = endD.getUTCHours() * 60 + endD.getUTCMinutes();
      return currentMinutes >= startMin && currentMinutes <= endMin;
    });

    return {
      inSchedule: match,
      isSimulated: false,
      meetings: section.meetings,
    };
  }

  /**
   * Activa o desactiva la simulación de horario lectivo en el backend para pruebas.
   */
  async setSectionScheduleSimulation(
    sectionId: string,
    active: boolean,
    user?: AuthUser,
  ) {
    const isDev =
      process.env.NODE_ENV !== 'production' ||
      process.env.ENABLE_DEV_LOGIN === 'true';
    if (!isDev) {
      throw new ForbiddenException(
        'La simulación de horario lectivo solo está permitida en entornos de pruebas y desarrollo.',
      );
    }

    const section = await this.prisma.courseSection.findUnique({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException('Grupo no encontrado.');
    }

    await this.assertSectionOwnership(section, user);

    if (active) {
      this.simulatedSections.add(sectionId);
    } else {
      this.simulatedSections.delete(sectionId);
    }

    const status = await this.isSectionInClassTime(sectionId);
    return {
      sectionId,
      simulated: active,
      inSchedule: status.inSchedule,
      message: active
        ? 'Horario lectivo simulado activado en el backend para este grupo.'
        : 'Simulación de horario desactivada.',
    };
  }

  /**
   * Abre una nueva sesión de clase generando una semilla secreta y devolviendo el primer token QR dinámico.
   * Valida estrictamente que el grupo se encuentre dentro de su horario lectivo o con simulación activa en backend.
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

    // Validación de horario lectivo o simulación backend
    const scheduleCheck = await this.isSectionInClassTime(sectionId);
    if (!scheduleCheck.inSchedule) {
      throw new BadRequestException(
        'No es posible abrir una sesión fuera del horario académico configurado para esta asignatura. Para realizar pruebas de demostración, activa la simulación de horario en el backend.',
      );
    }

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
          include: { subject: true, professor: true },
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
        OR: [
          { sectionId: session.sectionId },
          ...(session.section?.subjectId ? [{ subjectId: session.section.subjectId }] : []),
        ],
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

    const recordInclude = {
      session: {
        include: {
          section: {
            include: {
              subject: true,
              professor: true,
            },
          },
        },
      },
    };

    if (typeof (this.prisma.attendanceRecord as any)?.create === 'function') {
      return this.prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId,
          status: AttendanceStatus.PRESENT,
          method: AttendanceMethod.QR,
          markedAt: new Date(),
        },
        include: recordInclude,
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
      include: recordInclude,
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
   * Elimina un registro de asistencia por su ID (para pruebas y reversión controlada).
   */
  async deleteRecord(recordId: string, user?: AuthUser) {
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        session: {
          include: { section: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Registro de asistencia no encontrado.');
    }

    if (user && existing.session?.section) {
      await this.assertSectionOwnership(existing.session.section, user);
    }

    await this.prisma.attendanceRecord.delete({
      where: { id: recordId },
    });

    return { success: true, message: 'Registro de asistencia eliminado con éxito.' };
  }

  /**
   * Elimina la asistencia de un alumno específico en una sesión dada (por studentId o cuenta).
   */
  async resetStudentAttendanceInSession(sessionId: string, studentId: string, user?: AuthUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { section: true },
    });

    if (!session) {
      throw new NotFoundException('Sesión de clase no encontrada.');
    }

    if (user && session.section) {
      await this.assertSectionOwnership(session.section, user);
    }

    // Buscar si studentId es un UUID directo o si pertenece a un student con ese id/cuenta
    const deleted = await this.prisma.attendanceRecord.deleteMany({
      where: {
        sessionId,
        OR: [
          { studentId },
          { student: { id: studentId } },
        ],
      },
    });

    return {
      success: true,
      count: deleted.count,
      message: `Se eliminaron ${deleted.count} registro(s) de asistencia para la sesión.`,
    };
  }

  /**
   * Elimina todos los registros de asistencia de una sesión de clase (reinicio general de pruebas).
   */
  async resetAllSessionAttendances(sessionId: string, user?: AuthUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { section: true },
    });

    if (!session) {
      throw new NotFoundException('Sesión de clase no encontrada.');
    }

    if (user && session.section) {
      await this.assertSectionOwnership(session.section, user);
    }

    const deleted = await this.prisma.attendanceRecord.deleteMany({
      where: { sessionId },
    });

    return {
      success: true,
      count: deleted.count,
      message: `Se eliminaron todos los registros (${deleted.count}) de la sesión.`,
    };
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
   * Devuelve la lista completa de alumnos del grupo con su estado puntual: PRESENT o PENDING.
   */
  async getSessionRecords(sessionId: string, user?: AuthUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        section: {
          include: {
            subject: true,
            roster: {
              include: {
                linkedStudent: {
                  include: { user: true },
                },
              },
            },
            enrollments: {
              include: {
                student: {
                  include: { user: true },
                },
              },
            },
          },
        },
        records: {
          include: {
            student: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Sesión de clase no encontrada.');
    }

    if (user && session.section) {
      await this.assertSectionOwnership(session.section, user);
    }

    // Mapear registros de asistencia por studentId
    const recordByStudentId = new Map<string, any>();
    (session.records || []).forEach((rec) => {
      recordByStudentId.set(rec.studentId, rec);
    });

    // Construir lista única de todos los alumnos asignados al grupo
    const combinedStudents = new Map<
      string,
      {
        studentId: string;
        accountNumber: string;
        name: string;
        subject: string;
        subjectCode: number | null;
        group: string;
        status: 'PRESENT' | 'PENDING' | 'ABSENT' | 'LATE' | 'EXCUSED';
        method: string | null;
        markedAt: string | null;
        recordId: string | null;
      }
    >();

    // 1. Agregar alumnos desde la lista oficial del grupo (SectionRoster)
    (session.section?.roster || []).forEach((r) => {
      const studentId = r.linkedStudentId || r.id;
      const rec =
        recordByStudentId.get(studentId) ||
        (r.linkedStudentId ? recordByStudentId.get(r.linkedStudentId) : null);
      const studentObj = r.linkedStudent;
      const userObj = studentObj?.user;
      const name = userObj
        ? `${userObj.lastNameP} ${userObj.lastNameM || ''} ${userObj.name}`.trim()
        : r.fullName;

      combinedStudents.set(studentId, {
        studentId,
        accountNumber: String(r.accountNumber),
        name,
        subject: session.section?.subject?.subject || 'Asignatura',
        subjectCode: session.section?.subject?.code || null,
        group: session.section ? `Grupo ${session.section.groupCode}` : 'Grupo',
        status: rec ? rec.status : 'PENDING',
        method: rec?.method || null,
        markedAt: rec?.markedAt ? rec.markedAt.toISOString() : null,
        recordId: rec?.id || null,
      });
    });

    // 2. Agregar alumnos desde inscripciones académicas (Enrollment) si no estaban en el roster
    (session.section?.enrollments || []).forEach((e) => {
      const st = e.student;
      if (!st) return;
      const studentId = st.id;
      if (!combinedStudents.has(studentId)) {
        const rec = recordByStudentId.get(studentId);
        const userObj = st.user;
        const name = userObj
          ? `${userObj.lastNameP} ${userObj.lastNameM || ''} ${userObj.name}`.trim()
          : 'Alumno';

        combinedStudents.set(studentId, {
          studentId,
          accountNumber: String(st.accountNumber),
          name,
          subject: session.section?.subject?.subject || 'Asignatura',
          subjectCode: session.section?.subject?.code || null,
          group: session.section
            ? `Grupo ${session.section.groupCode}`
            : 'Grupo',
          status: rec ? rec.status : 'PENDING',
          method: rec?.method || null,
          markedAt: rec?.markedAt ? rec.markedAt.toISOString() : null,
          recordId: rec?.id || null,
        });
      }
    });

    return Array.from(combinedStudents.values());
  }

  /**
   * Consulta el horario oficial y asignaturas inscritas del estudiante autenticado desde la base de datos.
   */
  async getMySchedule(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: EnrollmentStatus.IN_PROGRESS,
      },
      include: {
        subject: true,
        period: true,
        section: {
          include: {
            professor: true,
            meetings: {
              orderBy: { weekday: 'asc' },
            },
          },
        },
      },
      orderBy: { subject: { code: 'asc' } },
    });

    const dayNameMap: Record<number, string> = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      7: 'Domingo',
    };

    const dayAbbrMap: Record<number, string> = {
      1: 'LU',
      2: 'MA',
      3: 'MI',
      4: 'JU',
      5: 'VI',
      6: 'SA',
      7: 'DO',
    };

    const subjects = enrollments.map((enr, idx) => {
      const sec = enr.section;
      const sub = enr.subject;
      const meetings = sec?.meetings || [];

      const days =
        meetings
          .map((m) => dayNameMap[m.weekday] || '')
          .filter(Boolean)
          .join(' y ') || 'Por definir';

      let time = '09:00 - 11:00';
      if (meetings.length > 0) {
        const start = new Date(meetings[0].startTime);
        const end = new Date(meetings[0].endTime);
        const sH = start.getUTCHours().toString().padStart(2, '0');
        const sM = start.getUTCMinutes().toString().padStart(2, '0');
        const eH = end.getUTCHours().toString().padStart(2, '0');
        const eM = end.getUTCMinutes().toString().padStart(2, '0');
        time = `${sH}:${sM} - ${eH}:${eM}`;
      }

      const rawDays = meetings
        .map((m) => dayAbbrMap[m.weekday] || '')
        .filter(Boolean)
        .join(',');
      const rawSchedule = `${rawDays} ${time.replace(' - ', ' a ')}`;

      const professorName = sec?.professor
        ? `${sec.professor.name} ${sec.professor.lastNameP} ${sec.professor.lastNameM || ''}`.trim()
        : 'Profesor asignado';

      return {
        index: idx + 1,
        code: sub.code ? String(sub.code) : `100${idx + 1}`,
        name: sub.subject,
        officialName: sub.subject,
        credits: sub.credits || 8,
        group: sec ? `Grupo ${sec.groupCode}` : 'Grupo asignado',
        rawSchedule,
        days,
        time,
        classroom: sec?.meetings?.[0]?.room || 'Edificio A-8',
        professor: professorName,
        matchStatus: 'matched' as const,
        subjectID: sub.id,
        realSubjectId: sub.id,
        sectionId: sec?.id || null,
      };
    });

    return {
      period: enrollments[0]?.period?.code || '2027-1',
      subjects,
      totalCredits: subjects.reduce((acc, s) => acc + (s.credits || 0), 0),
    };
  }
}
