import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';

@Injectable()
export class ContestService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateContestDto) {
    return this.prisma.contest.create({
      data: dto,
    });
  }

  async enroll(dto: EnrollStudentDto) {
    if (!dto.studentId) {
      throw new BadRequestException('El studentId es obligatorio.');
    }

    // Validar concurso existente
    const contest = await this.prisma.contest.findUnique({
      where: { id: dto.contestId },
    });
    if (!contest) {
      throw new NotFoundException('Concurso no encontrado.');
    }

    // Validar si ya está inscrito
    const existing = await this.prisma.studentContest.findFirst({
      where: {
        studentId: dto.studentId,
        contestId: dto.contestId,
      },
    });

    if (existing) {
      return this.prisma.studentContest.findUnique({
        where: { id: existing.id },
        include: {
          contest: true,
          student: { include: { user: true } },
        },
      });
    }

    return await this.prisma.studentContest.create({
      data: {
        studentId: dto.studentId,
        contestId: dto.contestId,
      },
      include: {
        contest: true,
        student: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findAll() {
    return await this.prisma.contest.findMany({
      include: {
        category: true,
      },
    });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.studentContest.findMany({
      where: { studentId },
      include: {
        contest: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findStudentWithContests(accountNumber: number) {
    const student = await this.prisma.student.findUnique({
      where: { accountNumber },
      include: {
        user: true,
        contests: {
          include: {
            contest: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`No se encontró ningún alumno con la cuenta: ${accountNumber}`);
    }

    return student;
  }

  async updateEnrollment(id: string, dto: { contestId: string }, studentId?: string) {
    const existing = await this.prisma.studentContest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Inscripción al concurso no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para modificar esta inscripción.');
    }

    return await this.prisma.studentContest.update({
      where: { id },
      data: { contestId: dto.contestId },
      include: { contest: true },
    });
  }

  async removeEnrollment(id: string, studentId?: string) {
    const existing = await this.prisma.studentContest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Inscripción al concurso no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para eliminar esta inscripción.');
    }

    return await this.prisma.studentContest.delete({
      where: { id },
    });
  }
}
