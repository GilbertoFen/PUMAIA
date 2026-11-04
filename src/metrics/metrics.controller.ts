import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType, QuestionnaireKind } from '@prisma/client';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get('academic-performance')
  async getAcademicPerformance(
    @Query('periodId') periodId?: string,
    @Query('careerId') careerId?: string,
  ) {
    return this.service.getAcademicPerformance(periodId, careerId);
  }

  @Get('retention-risk')
  async getRetentionAndRisk(
    @Query('careerId') careerId?: string,
  ) {
    return this.service.getRetentionAndRiskMetrics(careerId);
  }

  @Get('attendance')
  async getAttendance(
    @Query('periodId') periodId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.service.getAttendanceOverview(periodId, subjectId);
  }

  @Get('chat-topics')
  async getChatTopics() {
    return this.service.getChatTopicDistribution();
  }

  @Get('satisfaction')
  async getSatisfaction(
    @Query('kind') kind?: QuestionnaireKind,
  ) {
    return this.service.getSatisfactionSurveyMetrics(kind);
  }
}

