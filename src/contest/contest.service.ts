import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContestDto } from './dto/create-contest.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { NotFoundException } from '@nestjs/common/exceptions/not-found.exception';
@Injectable()
export class ContestService {
  constructor(private prisma: PrismaService) { }

  create(dto: CreateContestDto) {
    return this.prisma.contest.create({
      data: dto,
    });
  }

  async enroll(dto: EnrollStudentDto) {
    return await this.prisma.studentContest.create({
      data: {
        studentId: dto.studentId,
        contestId: dto.contestId,
      },
      include: {
        contest: true,
        student: true,
      },
    });
  }

  async findAll() {
    // Consultamos directamente el catálogo global de concursos
    return await this.prisma.contest.findMany();
  }
  async findByStudent(studentId: string) {
    return await this.prisma.studentContest.findMany({
      where: { studentId },
      include: {
        contest: true,
      },
    });
  }

  async findStudentWithContests(accountNumber: number) {
    const student = await this.prisma.student.findUnique({
      where: { accountNumber },
      include: {
        contests: {
          include: {
            contest: true
          }
        }
      }
    });

    if (!student) {
      throw new NotFoundException(`No se encontró ningún alumno con la cuenta: ${accountNumber}`);
    }

    return student;
  }
  // En tu contest.service.ts
  async updateEnrollment(id: string, dto: { contestId: string }) {
    return await this.prisma.studentContest.update({
      where: { id },
      data: { contestId: dto.contestId },
      include: { contest: true }
    });
  }

  async removeEnrollment(id: string) {
    return await this.prisma.studentContest.delete({
      where: { id }
    });
  }
}
