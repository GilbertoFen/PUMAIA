import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  AddRosterStudentDto,
  UploadRosterDto,
  ConfirmRosterStudentDto,
  CreateScheduleImportDto,
} from './dto/add-roster-student.dto';
import {
  RosterOrigin,
  RosterStatus,
  EnrollmentStatus,
  EnrollmentSource,
  RoleType,
} from '@prisma/client';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import * as crypto from 'crypto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Límite de intentos fallidos de código (en memoria: válido con una sola instancia del backend)
  private readonly joinAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private static readonly MAX_JOIN_FAILS = 5;
  private static readonly JOIN_WINDOW_MS = 10 * 60 * 1000;

  private assertJoinAttemptsAllowed(studentId: string) {
    const e = this.joinAttempts.get(studentId);
    if (
      e &&
      e.resetAt > Date.now() &&
      e.count >= SectionsService.MAX_JOIN_FAILS
    ) {
      throw new BadRequestException(
        'Demasiados intentos con códigos inválidos. Intenta de nuevo en unos minutos.',
      );
    }
  }

  private registerFailedJoin(studentId: string) {
    const now = Date.now();
    const e = this.joinAttempts.get(studentId);
    if (!e || e.resetAt <= now) {
      this.joinAttempts.set(studentId, {
        count: 1,
        resetAt: now + SectionsService.JOIN_WINDOW_MS,
      });
    } else {
      e.count += 1;
    }
  }

  /**
   * Resuelve el professorId asociado al usuario autenticado.
   */
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
   * Verifica que el usuario sea administrador institucional o el profesor titular del grupo (`section.professorId`).
   */
  async assertSectionOwnership(
    section: { id: string; professorId?: string | null },
    user?: AuthUser,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Se requiere un usuario autenticado.');
    }
    if (user.roles?.includes(RoleType.INSTITUTION_ADMIN)) {
      return;
    }

    if (!user.roles?.includes(RoleType.PROFESSOR)) {
      throw new ForbiddenException(
        'Solo el profesor titular del grupo o un administrador institucional puede realizar esta acción.',
      );
    }

    const profId = await this.resolveProfessorId(user);
    if (!profId || !section.professorId || section.professorId !== profId) {
      throw new ForbiddenException(
        'No eres el profesor titular asignado a este grupo académico.',
      );
    }
  }

  private async isAuthorizedForSectionSensitiveData(
    section: { professorId?: string | null },
    user?: AuthUser,
  ): Promise<boolean> {
    if (!user) return false;
    if (user.roles?.includes(RoleType.INSTITUTION_ADMIN)) return true;
    if (user.roles?.includes(RoleType.PROFESSOR)) {
      const profId = await this.resolveProfessorId(user);
      return Boolean(
        profId && section.professorId && section.professorId === profId,
      );
    }
    return false;
  }

  private sanitizeUserObject(userObj: any) {
    if (!userObj || typeof userObj !== 'object') return userObj;
    return {
      id: userObj.id,
      name: userObj.name,
      lastNameP: userObj.lastNameP,
      lastNameM: userObj.lastNameM,
      email: userObj.email,
      status: userObj.status,
    };
  }

  /**
   * Crea un nuevo grupo académico para una materia en un periodo específico.
   */
  async createSection(dto: CreateSectionDto) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException('Materia no encontrada.');
    }

    const period = await this.prisma.academicPeriod.findUnique({
      where: { id: dto.periodId },
    });
    if (!period) {
      throw new NotFoundException('Periodo académico no encontrado.');
    }

    const existingGroup = await this.prisma.courseSection.findUnique({
      where: {
        subjectId_periodId_groupCode: {
          subjectId: dto.subjectId,
          periodId: dto.periodId,
          groupCode: dto.groupCode.trim(),
        },
      },
    });

    if (existingGroup) {
      throw new ConflictException(
        `El grupo ${dto.groupCode} ya existe para esta materia en el periodo seleccionado.`,
      );
    }

    const joinCode =
      dto.joinCode?.trim() ||
      crypto.randomBytes(4).toString('hex').toUpperCase();

    return this.prisma.courseSection.create({
      data: {
        subjectId: dto.subjectId,
        periodId: dto.periodId,
        groupCode: dto.groupCode.trim(),
        capacity: dto.capacity || null,
        joinCode,
        professorId: dto.professorId || null,
      },
      include: {
        subject: true,
        period: true,
        professor: true,
      },
    });
  }

  /**
   * Lista grupos con filtros opcionales.
   * Oculta joinCode a estudiantes o profesores que no sean titulares del grupo.
   */
  async findAll(
    periodId?: string,
    subjectId?: string,
    professorId?: string,
    user?: AuthUser,
  ) {
    let effectiveProfessorId = professorId;
    if (
      user?.roles?.includes(RoleType.PROFESSOR) &&
      !user?.roles?.includes(RoleType.INSTITUTION_ADMIN)
    ) {
      const profId = await this.resolveProfessorId(user);
      if (!profId) return [];
      effectiveProfessorId = profId;
    }

    const sections = await this.prisma.courseSection.findMany({
      where: {
        ...(periodId && { periodId }),
        ...(subjectId && { subjectId }),
        ...(effectiveProfessorId && { professorId: effectiveProfessorId }),
      },
      include: {
        subject: true,
        period: true,
        professor: true,
        meetings: {
          orderBy: { weekday: 'asc' },
        },
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
        _count: {
          select: {
            roster: true,
            enrollments: true,
            sessions: true,
          },
        },
      },
      orderBy: { groupCode: 'asc' },
    });

    if (!user) return sections;

    const results = await Promise.all(
      sections.map(async (sec: any) => {
        const canSeeSensitive = await this.isAuthorizedForSectionSensitiveData(
          sec,
          user,
        );
        if (canSeeSensitive) return sec;
        const {
          joinCode: _hiddenJoinCode,
          roster: _hiddenRoster,
          enrollments: _hiddenEnrollments,
          ...publicSection
        } = sec;
        return publicSection;
      }),
    );

    return results;
  }

  /**
   * Obtiene un grupo por ID con sus horarios, lista y relaciones.
   * Si el solicitante es estudiante o profesor no titular, omite joinCode y roster con PII.
   */
  async findOne(id: string, user?: AuthUser) {
    const section = await this.prisma.courseSection.findUnique({
      where: { id },
      include: {
        subject: true,
        period: true,
        professor: true,
        meetings: {
          orderBy: { weekday: 'asc' },
        },
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
        _count: {
          select: {
            sessions: true,
            enrollments: true,
          },
        },
      },
    });

    if (!section) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado.`);
    }

    if (
      user?.roles?.includes(RoleType.PROFESSOR) &&
      !user?.roles?.includes(RoleType.INSTITUTION_ADMIN)
    ) {
      const profId = await this.resolveProfessorId(user);
      if (!profId || section.professorId !== profId) {
        throw new ForbiddenException(
          'No tienes permiso para consultar este grupo académico.',
        );
      }
    }

    const canSeeSensitive = await this.isAuthorizedForSectionSensitiveData(
      section,
      user,
    );

    if (!canSeeSensitive) {
      const { joinCode: _jc, roster: _roster, ...sanitized } = section as any;
      return {
        ...sanitized,
        rosterCount: Array.isArray((section as any).roster)
          ? (section as any).roster.length
          : 0,
      };
    }

    // Aun para profesor titular o administrador, jamás exponer googleSub o hashes del usuario
    if (Array.isArray((section as any).roster)) {
      (section as any).roster = (section as any).roster.map((item: any) => ({
        ...item,
        linkedStudent: item.linkedStudent
          ? {
              ...item.linkedStudent,
              user: this.sanitizeUserObject(item.linkedStudent.user),
            }
          : null,
      }));
    }

    return section;
  }

  /**
   * Obtiene internamente el grupo sin recortar campos para validaciones del servicio.
   */
  private async findOneRaw(id: string) {
    const section = await this.prisma.courseSection.findUnique({
      where: { id },
    });
    if (!section) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado.`);
    }
    return section;
  }

  /**
   * Agrega un horario de reunión al grupo (requiere titularidad del profesor o admin).
   */
  async addMeeting(sectionId: string, dto: CreateMeetingDto, user?: AuthUser) {
    const section = await this.findOneRaw(sectionId);
    await this.assertSectionOwnership(section, user);

    const hhmm = (t: string) => {
      const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
      return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
    };
    const a = hhmm(dto.startTime);
    const b = hhmm(dto.endTime);
    if (!a || !b) {
      throw new BadRequestException(
        'Las horas deben tener formato HH:mm o HH:mm:ss.',
      );
    }
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(`${today}T${a}:00.000Z`);
    const end = new Date(`${today}T${b}:00.000Z`);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException(
        'El horario de inicio debe ser menor al horario de fin.',
      );
    }

    return this.prisma.sectionMeeting.create({
      data: {
        sectionId,
        weekday: dto.weekday,
        startTime: start,
        endTime: end,
        room: dto.room || null,
      },
    });
  }

  /**
   * Elimina un horario de reunión (requiere titularidad del profesor o admin).
   */
  async removeMeeting(meetingId: string, user?: AuthUser) {
    const meeting = await this.prisma.sectionMeeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) {
      throw new NotFoundException('Horario no encontrado.');
    }

    if (user && meeting.sectionId) {
      const section = await this.findOneRaw(meeting.sectionId);
      await this.assertSectionOwnership(section, user);
    }

    return this.prisma.sectionMeeting.delete({
      where: { id: meetingId },
    });
  }

  /**
   * Agrega un estudiante a la lista oficial del grupo e intenta vincularlo a su perfil y Enrollment.
   */
  async addRosterStudent(
    sectionId: string,
    dto: AddRosterStudentDto,
    user?: AuthUser,
  ) {
    const section = await this.findOneRaw(sectionId);
    await this.assertSectionOwnership(section, user);

    const matchingStudent = await this.prisma.student.findUnique({
      where: { accountNumber: dto.accountNumber },
    });

    const status = matchingStudent
      ? RosterStatus.LINKED
      : dto.status || RosterStatus.LISTED;

    return this.prisma.$transaction(async (tx) => {
      let enrollmentConflict = false;
      const rosterItem = await tx.sectionRoster.create({
        data: {
          sectionId,
          accountNumber: dto.accountNumber,
          fullName: dto.fullName.trim(),
          origin: dto.origin || RosterOrigin.PROFESSOR_LIST,
          status,
          linkedStudentId: matchingStudent?.id || null,
        },
        include: {
          linkedStudent: {
            include: { user: true },
          },
        },
      });

      if (matchingStudent) {
        const existingEnrollment = await tx.enrollment.findFirst({
          where: {
            studentId: matchingStudent.id,
            subjectId: section.subjectId,
            periodId: section.periodId,
          },
        });

        if (existingEnrollment) {
          // La lista es indicativa (sirve para pasar lista): no mueve a nadie de su grupo.
          if (!existingEnrollment.sectionId) {
            await tx.enrollment.update({
              where: { id: existingEnrollment.id },
              data: { sectionId: section.id },
            });
          } else if (existingEnrollment.sectionId !== section.id) {
            enrollmentConflict = true; // sigue en su grupo; solo se avisa
          }
        } else {
          await tx.enrollment.create({
            data: {
              studentId: matchingStudent.id,
              subjectId: section.subjectId,
              periodId: section.periodId,
              sectionId: section.id,
              status: EnrollmentStatus.IN_PROGRESS,
              source: EnrollmentSource.JOIN_CODE,
            },
          });
        }
      }

      if (rosterItem?.linkedStudent?.user) {
        (rosterItem as any).linkedStudent.user = this.sanitizeUserObject(
          rosterItem.linkedStudent.user,
        );
      }

      return { ...rosterItem, enrollmentConflict };
    });
  }

  /**
   * Carga masiva de lista oficial de alumnos (`RosterUpload` + `SectionRoster`).
   * Verifica titularidad del profesor o rol de administrador.
   */
  async uploadRoster(sectionId: string, dto: UploadRosterDto, user: AuthUser) {
    const section = await this.findOneRaw(sectionId);
    await this.assertSectionOwnership(section, user);

    if (!dto.students || dto.students.length === 0) {
      throw new BadRequestException(
        'La lista de estudiantes para importar no puede estar vacía.',
      );
    }

    let uploadRecord: any = null;
    if (typeof (this.prisma as any).rosterUpload?.create === 'function') {
      uploadRecord = await (this.prisma as any).rosterUpload.create({
        data: {
          sectionId,
          uploadedBy: user.userId,
          rowCount: dto.students.length,
        },
      });
    }

    const processed: any[] = [];
    for (const st of dto.students) {
      const existing = await this.prisma.sectionRoster.findUnique({
        where: {
          sectionId_accountNumber: {
            sectionId,
            accountNumber: st.accountNumber,
          },
        },
      });

      if (!existing) {
        const created = await this.addRosterStudent(
          sectionId,
          {
            accountNumber: st.accountNumber,
            fullName: st.fullName,
            origin: RosterOrigin.PROFESSOR_LIST,
          },
          user,
        );
        processed.push(created);
      } else {
        processed.push(existing);
      }
    }

    return {
      uploadId: uploadRecord?.id ?? null,
      sectionId,
      totalRows: dto.students.length,
      processedCount: processed.length,
      roster: processed,
    };
  }

  /**
   * Confirma un registro de `SectionRoster` (`RosterStatus.CONFIRMED`) validando titularidad del profesor.
   */
  async confirmRosterStudent(
    sectionId: string,
    rosterId: string,
    dto: ConfirmRosterStudentDto,
    user: AuthUser,
  ) {
    const section = await this.findOneRaw(sectionId);
    await this.assertSectionOwnership(section, user);

    const rosterEntry = await this.prisma.sectionRoster.findUnique({
      where: { id: rosterId },
    });

    if (!rosterEntry || rosterEntry.sectionId !== sectionId) {
      throw new NotFoundException(
        'El registro de lista no existe en este grupo académico.',
      );
    }

    let linkedStudentId =
      dto.linkedStudentId || rosterEntry.linkedStudentId || null;
    if (!linkedStudentId && this.prisma.student?.findUnique) {
      const matched = await this.prisma.student.findUnique({
        where: { accountNumber: rosterEntry.accountNumber },
      });
      linkedStudentId = matched?.id ?? null;
    }

    if (linkedStudentId) {
      const st = await this.prisma.student.findUnique({
        where: { id: linkedStudentId },
        select: { accountNumber: true },
      });
      if (!st || st.accountNumber !== rosterEntry.accountNumber) {
        throw new BadRequestException(
          'El alumno indicado no corresponde al número de cuenta de esta fila.',
        );
      }
    }

    const updated = await this.prisma.sectionRoster.update({
      where: { id: rosterId },
      data: {
        status: dto.status || RosterStatus.CONFIRMED,
        confirmedBy: user.userId,
        confirmedAt: new Date(),
        ...(linkedStudentId ? { linkedStudentId } : {}),
      },
    });

    return updated;
  }

  /**
   * Registra una importación de horario (`ScheduleImport`) para el estudiante o administrador autenticado
   * y vincula las inscripciones (`Enrollment`) correspondientes.
   */
  async createScheduleImport(
    studentId: string,
    dto: CreateScheduleImportDto,
    uploadedByUserId?: string,
  ) {
    const items = Array.isArray(dto.items) ? dto.items : [];
    const resolvedPeriodId = dto.periodId || items[0]?.periodId;

    let scheduleImport: any = null;
    if (
      resolvedPeriodId &&
      typeof (this.prisma as any).scheduleImport?.create === 'function'
    ) {
      scheduleImport = await (this.prisma as any).scheduleImport.create({
        data: {
          periodId: resolvedPeriodId,
          uploadedBy: uploadedByUserId || studentId,
          fileName: dto.fileName || null,
          rowCount: items.length,
        },
      });
    }

    const enrollmentsCreated: any[] = [];
    for (const item of items) {
      const [subject, period] = await Promise.all([
        this.prisma.subject.findUnique({
          where: { id: item.subjectId },
          select: { id: true },
        }),
        this.prisma.academicPeriod.findUnique({
          where: { id: item.periodId },
          select: { id: true },
        }),
      ]);
      if (!subject || !period) {
        throw new BadRequestException(
          'Materia o periodo inválido en el horario importado.',
        );
      }

      // El grupo solo se liga si es coherente con la materia/periodo y el alumno ya está en su lista.
      // En cualquier otro caso se usa el código de ingreso.
      let sectionId: string | null = null;
      if (item.sectionId) {
        const sec = await this.prisma.courseSection.findUnique({
          where: { id: item.sectionId },
          select: { id: true, subjectId: true, periodId: true },
        });
        if (
          sec &&
          sec.subjectId === item.subjectId &&
          sec.periodId === item.periodId
        ) {
          const inRoster = await this.prisma.sectionRoster.findFirst({
            where: { sectionId: sec.id, linkedStudentId: studentId },
            select: { id: true },
          });
          if (inRoster) sectionId = sec.id;
        }
      }

      const existing = await this.prisma.enrollment.findFirst({
        where: {
          studentId,
          subjectId: item.subjectId,
          periodId: item.periodId,
        },
      });

      if (existing) {
        // No se toca origen ni estado; solo se completa el grupo si estaba vacío
        if (
          sectionId &&
          !existing.sectionId &&
          existing.status === EnrollmentStatus.IN_PROGRESS
        ) {
          enrollmentsCreated.push(
            await this.prisma.enrollment.update({
              where: { id: existing.id },
              data: { sectionId },
            }),
          );
        } else {
          enrollmentsCreated.push(existing);
        }
      } else {
        enrollmentsCreated.push(
          await this.prisma.enrollment.create({
            data: {
              studentId,
              subjectId: item.subjectId,
              periodId: item.periodId,
              sectionId,
              status: EnrollmentStatus.IN_PROGRESS,
              source: EnrollmentSource.TRANSCRIPT,
            },
          }),
        );
      }
    }

    return {
      importId: scheduleImport?.id ?? null,
      rowCount: items.length,
      enrollmentsCount: enrollmentsCreated.length,
      enrollments: enrollmentsCreated,
    };
  }

  /**
   * Permite a un estudiante unirse a un grupo usando el joinCode.
   */
  async joinWithCode(studentId: string, joinCode: string) {
    this.assertJoinAttemptsAllowed(studentId);
    const cleanCode = joinCode.trim().toUpperCase();

    const section = await this.prisma.courseSection.findUnique({
      where: { joinCode: cleanCode },
      include: {
        subject: true,
        period: true,
        roster: true,
      },
    });

    if (!section) {
      this.registerFailedJoin(studentId);
      throw new NotFoundException('Código de grupo inválido o no encontrado.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado.');
    }

    // Un alumno que ya está en la lista (o llega tarde) nunca es bloqueado por el cupo
    const alreadyMember = section.roster.some(
      (r) =>
        r.linkedStudentId === student.id ||
        r.accountNumber === student.accountNumber,
    );
    if (
      section.capacity &&
      !alreadyMember &&
      section.roster.length >= section.capacity
    ) {
      throw new BadRequestException('El grupo ha alcanzado su cupo máximo.');
    }
    this.joinAttempts.delete(studentId);

    const fullName =
      `${student.user.name} ${student.user.lastNameP} ${student.user.lastNameM || ''}`.trim();

    return this.prisma.$transaction(async (tx) => {
      const existingInRoster = await tx.sectionRoster.findUnique({
        where: {
          sectionId_accountNumber: {
            sectionId: section.id,
            accountNumber: student.accountNumber,
          },
        },
      });

      if (existingInRoster) {
        if (!existingInRoster.linkedStudentId) {
          await tx.sectionRoster.update({
            where: { id: existingInRoster.id },
            data: {
              linkedStudentId: student.id,
              status: RosterStatus.LINKED,
            },
          });
        }
      } else {
        await tx.sectionRoster.create({
          data: {
            sectionId: section.id,
            accountNumber: student.accountNumber,
            fullName,
            origin: RosterOrigin.JOIN_CODE,
            status: RosterStatus.LINKED,
            linkedStudentId: student.id,
          },
        });
      }

      const existingEnrollment = await tx.enrollment.findFirst({
        where: {
          studentId: student.id,
          subjectId: section.subjectId,
          periodId: section.periodId,
        },
      });

      if (existingEnrollment) {
        await tx.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { sectionId: section.id },
        });
      } else {
        await tx.enrollment.create({
          data: {
            studentId: student.id,
            subjectId: section.subjectId,
            periodId: section.periodId,
            sectionId: section.id,
            status: EnrollmentStatus.IN_PROGRESS,
            source: EnrollmentSource.JOIN_CODE,
          },
        });
      }

      return {
        message: 'Te has unido exitosamente al grupo.',
        section: {
          id: section.id,
          groupCode: section.groupCode,
          subject: section.subject.subject,
          period: section.period.code,
        },
      };
    });
  }

  /**
   * Obtiene los grupos del estudiante autenticado (sin exponer joinCode).
   */
  async getStudentSections(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        sectionId: { not: null },
      },
      include: {
        section: {
          include: {
            subject: true,
            period: true,
            professor: true,
            meetings: true,
          },
        },
      },
    });

    return enrollments
      .map((e) => {
        if (!e.section) return null;
        const { joinCode: _hidden, ...safeSection } = e.section as any;
        return safeSection;
      })
      .filter(Boolean);
  }
}
