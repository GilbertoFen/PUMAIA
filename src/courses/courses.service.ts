import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourseUserDto } from './dto/create-course-user.dto';
import { UpdateCourseUserDto } from './dto/update-course-user.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}


  create(createCourseDto: CreateCourseDto) {
    return this.prisma.course.create({
      data: createCourseDto
    });

  }

  createCourseUser(createCourseUserDto: CreateCourseUserDto) {
    return this.prisma.studentCourse.create({
      data: createCourseUserDto
    });
  }

  findAll() {
    return this.prisma.course.findMany();
  }

  findOne(id: string) {
    return this.prisma.course.findUnique({
      where: { id }
    });
  }
  
  findCourseUsers(courseId: string) {
    return this.prisma.studentCourse.findMany({
      where: { courseId },
      include: { student: true }
    });
  }

  findCourseUsersByUserId(studentId: string) {
    return this.prisma.studentCourse.findMany({
      where: { studentId },
      include: { course: true }
    });
  }

  findCoursesByCategory(categoryId: string) {
    return this.prisma.course.findMany({
      where: { categoryId }
    });
  }

  update(id: string, updateCourseDto: UpdateCourseDto) {
    return this.prisma.course.update({
      where: { id },
      data: updateCourseDto
    });
  }

  updateCourseUser(id: string, updateCourseUserDto: UpdateCourseUserDto) {
    return this.prisma.studentCourse.update({
      where: { id },
      data: updateCourseUserDto
    });
  }

  removeCourseUser(id: string) {
    return this.prisma.studentCourse.delete({
      where: { id }
    });
  }

  remove(id: string) {
    return this.prisma.course.delete({
      where: { id }
    });
  }
}
