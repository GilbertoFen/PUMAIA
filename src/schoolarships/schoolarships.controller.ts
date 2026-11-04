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
import { SchoolarshipsService } from './schoolarships.service';
import { CreateSchoolarshipDto } from './dto/create-schoolarship.dto';
import { UpdateSchoolarshipDto } from './dto/update-schoolarship.dto';
import { CreateSchoolarshipUsersDto } from './dto/create-schoolarship-users.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('schoolarships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolarshipsController {
  constructor(private readonly schoolarshipsService: SchoolarshipsService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  create(@Body() dto: CreateSchoolarshipDto) {
    return this.schoolarshipsService.create(dto);
  }

  @Get()
  findAll() {
    return this.schoolarshipsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolarshipsService.findOne(id);
  }

  @Get('category/:categoryId')
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.schoolarshipsService.findSchoolarshipsByCategory(categoryId);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSchoolarshipDto) {
    return this.schoolarshipsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  remove(@Param('id') id: string) {
    return this.schoolarshipsService.remove(id);
  }

  @Post('assign')
  createSchoolarshipUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSchoolarshipUsersDto,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const targetStudentId = isStudent ? user.studentId : (dto.studentId || user.studentId);

    if (!targetStudentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    return this.schoolarshipsService.createSchoolarshipUser({
      ...dto,
      studentId: targetStudentId,
    });
  }

  @Get('student/:studentId')
  findByStudent(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para consultar las becas de otro estudiante.');
    }

    return this.schoolarshipsService.findByStudent(studentId);
  }

  @Delete('assign/:id')
  removeSchoolarshipUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.schoolarshipsService.removeSchoolarshipUser(id, studentIdFilter);
  }
}
