import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/createGrade.dto';
import { UpdateGradeDto, ConfirmGradesDto } from './dto/updateGrade.dto';
import { EnrollmentStatus, EnrollmentSource } from '@prisma/client';

@Injectable()
export class GradeService {
  private readonly logger = new Logger(GradeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Recalcula el promedio general del estudiante a partir de todas sus inscripciones con calificación numérica.
   * Regla y fórmula académica oficial:
   * Promedio = SUM(calificaciones numéricas de materias registradas) / COUNT(materias con calificación)
   * Se redondea a dos cifras decimales.
   * Las inscripciones en curso (IN_PROGRESS), bajas (WITHDRAWN) o sin presentar (NOT_PRESENTED)
   * con grade = null se excluyen del divisor y dividendo.
   * Si no quedan materias con calificación, el promedio se establece en null.
   */
  private async recalculateStudentAverage(tx: any, studentId: string): Promise<number | null> {
    const allEnrollments = await tx.enrollment.findMany({
      where: { studentId, grade: { not: null } },
    });

    if (allEnrollments.length === 0) {
      await tx.student.update({
        where: { id: studentId },
        data: { average: null },
      });
      return null;
    }

    const sum = allEnrollments.reduce((acc: number, curr: any) => acc + (curr.grade || 0), 0);
    const newAverage = parseFloat((sum / allEnrollments.length).toFixed(2));

    await tx.student.update({
      where: { id: studentId },
      data: { average: newAverage },
    });

    return newAverage;
  }

  /**
   * Consulta general de inscripciones (administración).
   */
  async getAllGrades() {
    return this.prisma.enrollment.findMany({
      include: {
        subject: true,
        student: {
          include: {
            user: { select: { name: true, lastNameP: true, email: true } },
          },
        },
        period: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta una inscripción específica por ID.
   */
  async getGradeById(id: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_REGEX.test(id)) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada.`);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        subject: true,
        period: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada.`);
    }

    return enrollment;
  }

  /**
   * Registra una inscripción / calificación individual recalculando atómicamente el promedio.
   */
  async createGrade(dto: CreateGradeDto) {
    if (!dto.studentID) {
      throw new BadRequestException('El studentID es obligatorio.');
    }

    const calculatedStatus =
      dto.status ||
      (dto.grade !== undefined && dto.grade !== null
        ? dto.grade >= 6
          ? EnrollmentStatus.PASSED
          : EnrollmentStatus.FAILED
        : EnrollmentStatus.IN_PROGRESS);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.create({
        data: {
          grade: dto.grade,
          status: calculatedStatus,
          attempt: dto.attempt || 1,
          source: dto.source || EnrollmentSource.TRANSCRIPT,
          student: { connect: { id: dto.studentID } },
          subject: { connect: { id: dto.subjectID } },
          ...(dto.periodId ? { period: { connect: { id: dto.periodId } } } : {}),
        },
        include: {
          subject: true,
        },
      });

      await this.recalculateStudentAverage(tx, dto.studentID!);

      return created;
    });
  }

  /**
   * Actualiza una inscripción existente y recalcula atómicamente el promedio del alumno.
   */
  async updateGrade(id: string, dto: UpdateGradeDto) {
    const existing = await this.getGradeById(id);

    const dataToUpdate: any = {};

    if (dto.grade !== undefined) {
      dataToUpdate.grade = dto.grade;
      dataToUpdate.status = dto.grade >= 6 ? EnrollmentStatus.PASSED : EnrollmentStatus.FAILED;
    }

    if (dto.status) dataToUpdate.status = dto.status;
    if (dto.attempt) dataToUpdate.attempt = dto.attempt;
    if (dto.source) dataToUpdate.source = dto.source;
    if (dto.subjectID) dataToUpdate.subject = { connect: { id: dto.subjectID } };
    if (dto.periodId) dataToUpdate.period = { connect: { id: dto.periodId } };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.enrollment.update({
        where: { id },
        data: dataToUpdate,
        include: { subject: true },
      });

      await this.recalculateStudentAverage(tx, existing.studentId);

      return updated;
    });
  }

  /**
   * Elimina una inscripción y recalcula atómicamente el promedio del alumno.
   */
  async deleteGrade(id: string) {
    const existing = await this.getGradeById(id);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.enrollment.delete({
        where: { id },
      });

      await this.recalculateStudentAverage(tx, existing.studentId);

      return deleted;
    });
  }

  /**
   * Confirma e inserta/actualiza las materias validadas tras la lectura del PDF.
   * Realiza un Upsert sobre Enrollment y actualiza atómicamente el promedio del alumno.
   */
  async saveConfirmedGrades(studentId: string, dto: ConfirmGradesDto) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validSubjects = (dto.subjects || []).filter(
      (s) =>
        s &&
        s.subjectID &&
        UUID_REGEX.test(s.subjectID) &&
        typeof s.grade === 'number' &&
        !isNaN(s.grade) &&
        s.grade >= 5 &&
        s.grade <= 10
    );

    if (validSubjects.length === 0) {
      return {
        message: 'No se encontraron materias con formato UUID y calificación válida para registrar.',
        updatedCount: 0,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of validSubjects) {
        const status = item.grade >= 6 ? EnrollmentStatus.PASSED : EnrollmentStatus.FAILED;

        // Buscar si ya existe inscripción para este alumno y materia
        const existing = await tx.enrollment.findFirst({
          where: {
            studentId,
            subjectId: item.subjectID,
          },
        });

        if (existing) {
          await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              grade: item.grade,
              status,
              source: EnrollmentSource.TRANSCRIPT,
            },
          });
        } else {
          await tx.enrollment.create({
            data: {
              studentId,
              subjectId: item.subjectID,
              grade: item.grade,
              status,
              attempt: 1,
              source: EnrollmentSource.TRANSCRIPT,
            },
          });
        }
      }

      // Recalcular promedio dinámico atómico del alumno
      await this.recalculateStudentAverage(tx, studentId);

      if (dto.currentSemester && typeof dto.currentSemester === 'number') {
        await tx.student.update({
          where: { id: studentId },
          data: { currentSemester: dto.currentSemester },
        });
      }

      return {
        message: 'Historial académico registrado y promedio actualizado correctamente.',
        registeredCount: validSubjects.length,
        currentSemester: dto.currentSemester,
      };
    });
  }

  /**
   * Retorna el historial académico del alumno autenticado en el formato esperado por el frontend.
   */
  async getMyGrades(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        subject: true,
        period: true,
      },
      orderBy: {
        subject: {
          subject: 'asc',
        },
      },
    });

    // Mapeo retrocompatible con el frontend
    return enrollments.map((e) => ({
      id: e.id,
      subjectID: e.subjectId,
      subjectId: e.subjectId,
      subjectName: e.subject.subject,
      grade: e.grade,
      status: e.status,
      attempt: e.attempt,
      period: e.period?.code || null,
      exists: true,
    }));
  }
}
