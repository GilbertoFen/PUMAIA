import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSubjectDto } from './dto/createSubject.dto';
import { UpdateSubjectDto } from './dto/updateSubject.dto';
import { procesarYValidarHistorial } from '../utils/parser-pdf';
import { MateriaTemporal } from '../utils/types.js';
import { EnrollmentStatus, EnrollmentSource } from '@prisma/client';

@Injectable()
export class SubjectService {
  constructor(private prisma: PrismaService) {}

  async getAllSubjects() {
    return this.prisma.subject.findMany({
      include: {
        category: true,
        studyPlan: true,
      },
      orderBy: { subject: 'asc' },
    });
  }

  async getSubjectById(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        category: true,
        studyPlan: true,
        prerequisites: {
          include: { prerequisite: true },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Materia con ID ${id} no encontrada.`);
    }

    return subject;
  }

  async createSubject(dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        subject: dto.subject,
        code: dto.code,
        semester: dto.semester,
        credits: dto.credits,
        category: { connect: { id: dto.categoryID } },
        ...(dto.studyPlanId ? { studyPlan: { connect: { id: dto.studyPlanId } } } : {}),
      },
      include: {
        category: true,
        studyPlan: true,
      },
    });
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    await this.getSubjectById(id);

    return this.prisma.subject.update({
      where: { id },
      data: {
        subject: dto.subject,
        code: dto.code,
        semester: dto.semester,
        credits: dto.credits,
        ...(dto.categoryID ? { category: { connect: { id: dto.categoryID } } } : {}),
        ...(dto.studyPlanId ? { studyPlan: { connect: { id: dto.studyPlanId } } } : {}),
      },
      include: {
        category: true,
        studyPlan: true,
      },
    });
  }

  async deleteSubject(id: string) {
    await this.getSubjectById(id);

    return this.prisma.subject.delete({
      where: { id },
    });
  }

  async analyzeAndMatchHistory(fileBuffer: Buffer) {
    const markdown = await procesarYValidarHistorial(fileBuffer);

    if (!markdown) {
      throw new BadRequestException('El documento no es un historial válido.');
    }

    const materiasParaMatch: MateriaTemporal[] = [];
    const materiaRegex = /-\s+\*\*(.+?)\*\*:\s+(\d+)/g;
    let match: RegExpExecArray | null;

    while ((match = materiaRegex.exec(markdown)) !== null) {
      materiasParaMatch.push({
        nombre: match[1].trim(),
        calificacion: parseInt(match[2], 10),
      });
    }

    const catalogo = await this.prisma.subject.findMany();

    const subjectsMatched = materiasParaMatch.map((mPDF) => {
      const matchBD = catalogo.find(
        (mBD) => this.normalizar(mBD.subject) === this.normalizar(mPDF.nombre),
      );

      return {
        subjectID: matchBD?.id || null,
        subjectName: mPDF.nombre,
        grade: mPDF.calificacion,
        exists: !!matchBD,
      };
    });

    return {
      rawMarkdown: markdown,
      subjects: subjectsMatched,
    };
  }

  private normalizar(t: string): string {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /**
   * Procesa el PDF del historial, guarda inscripciones en Enrollment y actualiza promedio.
   */
  async saveAcademicHistory(studentId: string, fileBuffer: Buffer) {
    const analysis = await this.analyzeAndMatchHistory(fileBuffer);
    const validSubjects = analysis.subjects.filter((s) => s.exists && s.subjectID);

    if (validSubjects.length === 0) {
      throw new BadRequestException('No se encontraron materias válidas en el historial para guardar.');
    }

    // Verificar titularidad del número de cuenta del PDF contra el alumno autenticado
    const accountMatch = analysis.rawMarkdown.match(/\*\*Cuenta\*\*:\s*(\d+)/i);
    if (accountMatch && this.prisma.student?.findUnique) {
      const pdfAccount = parseInt(accountMatch[1], 10);
      const student = await this.prisma.student.findUnique({ where: { id: studentId } });
      if (student && student.accountNumber && student.accountNumber !== pdfAccount) {
        throw new ForbiddenException(
          `El número de cuenta del PDF (${pdfAccount}) no coincide con tu número de cuenta registrado (${student.accountNumber}).`,
        );
      }
    }

    let newAverage = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const subject of validSubjects) {
        const status = subject.grade >= 6 ? EnrollmentStatus.PASSED : EnrollmentStatus.FAILED;

        const existingEnrollment = await tx.enrollment.findFirst({
          where: {
            studentId,
            subjectId: subject.subjectID as string,
          },
        });

        if (existingEnrollment) {
          await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              grade: subject.grade,
              status,
              source: EnrollmentSource.TRANSCRIPT,
            },
          });
        } else {
          await tx.enrollment.create({
            data: {
              studentId,
              subjectId: subject.subjectID as string,
              grade: subject.grade,
              status,
              attempt: 1,
              source: EnrollmentSource.TRANSCRIPT,
            },
          });
        }
      }

      // Calcular promedio dinámico de inscripciones con calificación
      const allEnrollments = await tx.enrollment.findMany({
        where: { studentId, grade: { not: null } },
      });

      const sum = allEnrollments.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      newAverage = allEnrollments.length > 0 ? parseFloat((sum / allEnrollments.length).toFixed(2)) : 0;

      await tx.student.update({
        where: { id: studentId },
        data: { average: newAverage },
      });
    });

    return {
      message: 'Historial procesado y actualizado correctamente en inscripciones (Enrollment).',
      subjectsProcessed: validSubjects.length,
      newAverage,
      subjects: validSubjects,
    };
  }
}
