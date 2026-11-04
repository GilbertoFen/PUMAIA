import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateSchoolarshipDto } from './dto/create-schoolarship.dto';
import { UpdateSchoolarshipDto } from './dto/update-schoolarship.dto';
import { CreateSchoolarshipUsersDto } from './dto/create-schoolarship-users.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchoolarshipsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSchoolarshipDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    return this.prisma.schoolarship.create({
      data: dto,
    });
  }

  async createSchoolarshipUser(dto: CreateSchoolarshipUsersDto) {
    if (!dto.studentId) {
      throw new BadRequestException('El studentId es obligatorio.');
    }

    const scholarship = await this.prisma.schoolarship.findUnique({
      where: { id: dto.schoolarshipId },
    });
    if (!scholarship) {
      throw new NotFoundException('Beca no encontrada.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Estudiante no encontrado.');
    }

    const existing = await this.prisma.studentSchoolarship.findUnique({
      where: {
        studentId_schoolarshipId: {
          studentId: dto.studentId,
          schoolarshipId: dto.schoolarshipId,
        },
      },
    });

    if (existing) {
      return this.prisma.studentSchoolarship.findUnique({
        where: { id: existing.id },
        include: { schoolarship: true },
      });
    }

    return this.prisma.studentSchoolarship.create({
      data: {
        schoolarshipId: dto.schoolarshipId,
        studentId: dto.studentId,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: {
        schoolarship: true,
      },
    });
  }

  findAll() {
    return this.prisma.schoolarship.findMany({
      include: { category: true },
    });
  }

  findOne(id: string) {
    return this.prisma.schoolarship.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  findSchoolarshipsByCategory(categoryId: string) {
    return this.prisma.schoolarship.findMany({
      where: { categoryId },
    });
  }

  findSchoolarshipUsers(schoolarshipId: string) {
    return this.prisma.studentSchoolarship.findMany({
      where: { schoolarshipId },
      include: { student: { include: { user: true } } },
    });
  }

  findByStudent(studentId: string) {
    return this.prisma.studentSchoolarship.findMany({
      where: { studentId },
      include: { schoolarship: { include: { category: true } } },
    });
  }

  update(id: string, dto: UpdateSchoolarshipDto) {
    return this.prisma.schoolarship.update({
      where: { id },
      data: dto,
    });
  }

  remove(id: string) {
    return this.prisma.schoolarship.delete({
      where: { id },
    });
  }

  async removeSchoolarshipUser(id: string, studentId?: string) {
    const existing = await this.prisma.studentSchoolarship.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Asignación de beca no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para eliminar esta asignación de beca.');
    }

    return this.prisma.studentSchoolarship.delete({
      where: { id },
    });
  }
}
