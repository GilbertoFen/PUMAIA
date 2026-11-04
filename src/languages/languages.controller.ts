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
import { LanguagesService } from './languages.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { UpdateLanguageUserDto } from './dto/update-language-user.dto';
import { CreateLanguageUserDto } from './dto/create-language-user.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('languages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  create(@Body() createLanguageDto: CreateLanguageDto) {
    return this.languagesService.createLanguage(createLanguageDto);
  }

  @Post('languageUsers')
  createLanguageUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLanguageUserDto,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const targetStudentId = isStudent ? user.studentId : (dto.studentId || user.studentId);

    if (!targetStudentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    return this.languagesService.createLanguageUser({
      ...dto,
      studentId: targetStudentId,
    });
  }

  @Get()
  findAll() {
    return this.languagesService.findAllLanguages();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.languagesService.findOneLanguage(id);
  }

  @Get('languageUsers/user/:studentId')
  findLanguageUsersByUserId(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
  ) {
    const isStudent = user.roles.includes(RoleType.STUDENT);
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);

    if (isStudent && !isAdmin && user.studentId !== studentId) {
      throw new ForbiddenException('No tienes autorización para consultar los idiomas de otro estudiante.');
    }

    return this.languagesService.findLanguageUsersByUserId(studentId);
  }

  @Patch(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  update(@Param('id') id: string, @Body() updateLanguageDto: UpdateLanguageDto) {
    return this.languagesService.updateLanguage(id, updateLanguageDto);
  }

  @Patch('languageUsers/:id')
  updateLanguageUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLanguageUserDto,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.languagesService.updateLanguageUser(id, dto, studentIdFilter);
  }

  @Delete(':id')
  @Roles(RoleType.INSTITUTION_ADMIN)
  remove(@Param('id') id: string) {
    return this.languagesService.removeLanguage(id);
  }

  @Delete('languageUsers/:id')
  removeLanguageUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    const isAdmin = user.roles.includes(RoleType.INSTITUTION_ADMIN);
    const studentIdFilter = isAdmin ? undefined : user.studentId || undefined;

    return this.languagesService.removeLanguageUser(id, studentIdFilter);
  }
}
