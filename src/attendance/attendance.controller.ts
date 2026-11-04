import {
  Controller,
  Post,
  Patch,
  Get,
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
