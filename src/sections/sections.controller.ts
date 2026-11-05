import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import {
  AddRosterStudentDto,
  UploadRosterDto,
  ConfirmRosterStudentDto,
  CreateScheduleImportDto,
} from './dto/add-roster-student.dto';
import { JoinSectionDto } from './dto/join-section.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SectionsController {
  constructor(private readonly service: SectionsService) {}

  @Post()
  @Roles(RoleType.INSTITUTION_ADMIN)
  async createSection(@Body() dto: CreateSectionDto) {
    return this.service.createSection(dto);
  }

  @Get()
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST, RoleType.PROFESSOR)
  async findAll(
    @Query('periodId') periodId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('professorId') professorId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.findAll(periodId, subjectId, professorId, user);
  }

  @Get('my-sections')
  async getMySections(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.getStudentSections(user.studentId);
  }

  @Post('schedule-import')
  async importSchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScheduleImportDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.createScheduleImport(user.studentId, dto, user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post(':id/meetings')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async addMeeting(
    @Param('id') sectionId: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.addMeeting(sectionId, dto, user);
  }

  @Delete('meetings/:meetingId')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async removeMeeting(
    @Param('meetingId') meetingId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.removeMeeting(meetingId, user);
  }

  @Post(':id/roster')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async addRosterStudent(
    @Param('id') sectionId: string,
    @Body() dto: AddRosterStudentDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.addRosterStudent(sectionId, dto, user);
  }

  @Post(':id/roster/upload')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async uploadRoster(
    @Param('id') sectionId: string,
    @Body() dto: UploadRosterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.uploadRoster(sectionId, dto, user);
  }

  @Patch(':id/roster/:rosterId/confirm')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async confirmRosterStudent(
    @Param('id') sectionId: string,
    @Param('rosterId') rosterId: string,
    @Body() dto: ConfirmRosterStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.confirmRosterStudent(sectionId, rosterId, dto, user);
  }

  @Post('join')
  async joinWithCode(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinSectionDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.joinWithCode(user.studentId, dto.joinCode);
  }
}
