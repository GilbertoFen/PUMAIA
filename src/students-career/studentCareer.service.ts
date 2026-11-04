import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentCareerDto } from './dto/createStudentCareer.dto';
import { UpdateStudentCareerDto } from './dto/updateStudentCareer.dto';

/**
 * Servicio deprecado: En el esquema Prisma v3, la relación Student-Career es directa
 * mediante `Student.careerId` y `Student.isGraduated`. Este servicio adapta las peticiones
 * históricas hacia el modelo Student para evitar regresiones.
 */
@Injectable()
export class StudentCareerService {
  private readonly logger = new Logger(StudentCareerService.name);

  constructor(private prisma: PrismaService) {}

  async getAllStudentCareers() {
    const students = await this.prisma.student.findMany({
      include: {
        career: true,
      },
    });

    return students.map((s) => ({
      id: s.id,
      studentId: s.id,
      careerId: s.careerId,
      isGraduated: s.isGraduated,
      career: s.career,
    }));
  }

  async getStudentCareerById(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { career: true },
    });

    if (!student) {
      throw new NotFoundException(`Registro de alumno con ID ${id} no encontrado.`);
    }

    return {
      id: student.id,
      studentId: student.id,
      careerId: student.careerId,
      isGraduated: student.isGraduated,
      career: student.career,
    };
  }

  async createStudentCareer(dto: CreateStudentCareerDto) {
    // Validar existencia de la carrera
    const career = await this.prisma.career.findUnique({
      where: { id: dto.careerId },
    });

    if (!career) {
      throw new NotFoundException(`Carrera con ID ${dto.careerId} no encontrada.`);
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });

    if (!student) {
      throw new NotFoundException(`Alumno con ID ${dto.studentId} no encontrado.`);
    }

    const updated = await this.prisma.student.update({
      where: { id: dto.studentId },
      data: {
        careerId: dto.careerId,
        isGraduated: dto.isGraduated ?? false,
      },
      include: { career: true },
    });

    return {
      id: updated.id,
      studentId: updated.id,
      careerId: updated.careerId,
      isGraduated: updated.isGraduated,
      career: updated.career,
    };
  }

  async updateStudentCareer(id: string, dto: UpdateStudentCareerDto) {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      throw new NotFoundException(`Alumno con ID ${id} no encontrado.`);
    }

    if (dto.careerId) {
      const career = await this.prisma.career.findUnique({
        where: { id: dto.careerId },
      });
      if (!career) throw new NotFoundException(`Carrera con ID ${dto.careerId} no encontrada.`);
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.careerId ? { careerId: dto.careerId } : {}),
        ...(dto.isGraduated !== undefined ? { isGraduated: dto.isGraduated } : {}),
      },
      include: { career: true },
    });

    return {
      id: updated.id,
      studentId: updated.id,
      careerId: updated.careerId,
      isGraduated: updated.isGraduated,
      career: updated.career,
    };
  }

  async deleteStudentCareer(id: string) {
    // La carrera es un campo obligatorio en Student (Student.careerId).
    // No se elimina físicamente el alumno; se reinicia isGraduated a false.
    this.logger.warn(`deleteStudentCareer invocado para ${id}: reiniciando isGraduated a false.`);
    return this.prisma.student.update({
      where: { id },
      data: { isGraduated: false },
      select: { id: true, careerId: true, isGraduated: true },
    });
  }
}
