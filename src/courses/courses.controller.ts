import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateCourseUserDto } from './dto/create-course-user.dto';
import { UpdateCourseUserDto } from './dto/update-course-user.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Post('courseUser')
  createCourseUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCourseUserDto,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const targetStudentId = isStudent ? user.studentId : (dto.studentId || user.studentId);

    if (!targetStudentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    return this.coursesService.createCourseUser({
      ...dto,
      studentId: targetStudentId,
    });
  }

  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Get('courseUsers/:studentId')
  findCourseUsersByUserId(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para consultar los cursos de otro estudiante.');
    }

    return this.coursesService.findCourseUsersByUserId(studentId);
  }

  @Get('category/:categoryId')
  findCoursesByCategory(@Param('categoryId') categoryId: string) {
    return this.coursesService.findCoursesByCategory(categoryId);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Patch('courseUser/:id')
  updateCourseUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseUserDto,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.coursesService.updateCourseUser(id, dto, studentIdFilter);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  @Delete('courseUser/:id')
  removeCourseUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.coursesService.removeCourseUser(id, studentIdFilter);
  }
}
