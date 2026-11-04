import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseUserDto } from './dto/create-course-user.dto';
import { UpdateCourseUserDto } from './dto/update-course-user.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  create(createCourseDto: CreateCourseDto) {
    return this.prisma.course.create({
      data: createCourseDto,
    });
  }

  async createCourseUser(createCourseUserDto: CreateCourseUserDto) {
    if (!createCourseUserDto.studentId) {
      throw new BadRequestException('El studentId es obligatorio.');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: createCourseUserDto.courseId },
    });
    if (!course) {
      throw new NotFoundException('Curso no encontrado.');
    }

    const existing = await this.prisma.studentCourse.findUnique({
      where: {
        studentId_courseId: {
          studentId: createCourseUserDto.studentId,
          courseId: createCourseUserDto.courseId,
        },
      },
    });

    if (existing) {
      return this.prisma.studentCourse.findUnique({
        where: { id: existing.id },
        include: { course: true },
      });
    }

    return this.prisma.studentCourse.create({
      data: {
        courseId: createCourseUserDto.courseId,
        studentId: createCourseUserDto.studentId,
      },
      include: { course: true },
    });
  }

  findAll() {
    return this.prisma.course.findMany({
      include: { category: true },
    });
  }

  findOne(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  findCourseUsers(courseId: string) {
    return this.prisma.studentCourse.findMany({
      where: { courseId },
      include: { student: { include: { user: true } } },
    });
  }

  findCourseUsersByUserId(studentId: string) {
    return this.prisma.studentCourse.findMany({
      where: { studentId },
      include: { course: { include: { category: true } } },
    });
  }

  findCoursesByCategory(categoryId: string) {
    return this.prisma.course.findMany({
      where: { categoryId },
    });
  }

  update(id: string, updateCourseDto: UpdateCourseDto) {
    return this.prisma.course.update({
      where: { id },
      data: updateCourseDto,
    });
  }

  async updateCourseUser(id: string, updateCourseUserDto: UpdateCourseUserDto, studentId?: string) {
    const existing = await this.prisma.studentCourse.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Inscripción al curso no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para modificar este curso.');
    }

    return this.prisma.studentCourse.update({
      where: { id },
      data: updateCourseUserDto,
    });
  }

  remove(id: string) {
    return this.prisma.course.delete({
      where: { id },
    });
  }

  async removeCourseUser(id: string, studentId?: string) {
    const existing = await this.prisma.studentCourse.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Inscripción al curso no encontrada.');
    }

    if (studentId && existing.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para eliminar este curso.');
    }

    return this.prisma.studentCourse.delete({
      where: { id },
    });
  }
}
