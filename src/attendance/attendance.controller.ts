import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import { RoleType } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Post('sessions')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async openSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.service.openSession(dto.sectionId, user.userId, user);
  }

  @Get('sessions/:id/qr-token')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async getSessionQrToken(
    @Param('id') sessionId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.getSessionQrToken(sessionId, user);
  }

  @Post('record')
  async markAttendance(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkAttendanceDto,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.markAttendance(user.studentId, dto);
  }

  @Post('sessions/:id/close')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async closeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.closeSession(sessionId, user);
  }

  @Patch('records/:id')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async manualOverride(
    @CurrentUser() user: AuthUser,
    @Param('id') recordId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.service.manualOverride(recordId, dto, user.userId, user);
  }

  @Delete('records/:id')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async deleteRecord(
    @CurrentUser() user: AuthUser,
    @Param('id') recordId: string,
  ) {
    return this.service.deleteRecord(recordId, user);
  }

  @Delete('sessions/:sessionId/students/:studentId')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async resetStudentAttendance(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.service.resetStudentAttendanceInSession(sessionId, studentId, user);
  }

  @Delete('sessions/:sessionId/records')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async resetAllSessionAttendances(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.resetAllSessionAttendances(sessionId, user);
  }

  @Get('sections/:id/schedule-status')
  async getScheduleStatus(
    @Param('id') sectionId: string,
  ) {
    return this.service.isSectionInClassTime(sectionId);
  }

  @Post('sections/:id/simulate-schedule')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async simulateSchedule(
    @Param('id') sectionId: string,
    @Body('active') active: boolean,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setSectionScheduleSimulation(sectionId, Boolean(active), user);
  }

  @Get('my-schedule')
  async getMySchedule(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.getMySchedule(user.studentId);
  }

  @Get('my-attendance')
  async getMyAttendance(
    @CurrentUser() user: AuthUser,
    @Query('sectionId') sectionId?: string,
  ) {
    if (!user || !user.studentId) {
      throw new BadRequestException(
        'El usuario no cuenta con un perfil de estudiante vinculado.',
      );
    }
    return this.service.getMyAttendance(user.studentId, sectionId);
  }

  @Get('sessions/:id/records')
  @Roles(RoleType.INSTITUTION_ADMIN, RoleType.PROFESSOR)
  async getSessionRecords(
    @Param('id') sessionId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.getSessionRecords(sessionId, user);
  }
}
