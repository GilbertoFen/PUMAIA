import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { MetricsService } from './metrics.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import {
  AcademicPerformanceQueryDto,
  AttendanceQueryDto,
  RetentionRiskQueryDto,
  SatisfactionQueryDto,
} from './dto/metrics-query.dto';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
export class MetricsController {
  constructor(
    private readonly service: MetricsService,
    private readonly audit: AuditService,
  ) {}

  /** Cada consulta al dashboard queda en la bitácora: quién, qué endpoint y con qué filtros. */
  private async logAccess(
    user: AuthUser | null,
    endpoint: string,
    filters: object,
  ) {
    await this.audit.log({
      actorType: 'ADMIN',
      actorId: user?.userId,
      action: 'METRICS_VIEWED',
      detail: {
        endpoint,
        filters,
        roles: user?.roles ?? [],
        minGroupSize: this.service.minGroup,
      },
    });
  }

  @Get('academic-performance')
  async getAcademicPerformance(
    @Query() query: AcademicPerformanceQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.service.getAcademicPerformance(query);
    await this.logAccess(user, 'academic-performance', query);
    return result;
  }

  @Get('retention-risk')
  async getRetentionAndRisk(
    @Query() query: RetentionRiskQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.service.getRetentionAndRiskMetrics(query);
    await this.logAccess(user, 'retention-risk', query);
    return result;
  }

  @Get('attendance')
  async getAttendance(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.service.getAttendanceOverview(query);
    await this.logAccess(user, 'attendance', query);
    return result;
  }

  @Get('chat-topics')
  async getChatTopics(@CurrentUser() user: AuthUser) {
    const result = await this.service.getChatTopicDistribution();
    await this.logAccess(user, 'chat-topics', {});
    return result;
  }

  @Get('satisfaction')
  async getSatisfaction(
    @Query() query: SatisfactionQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.service.getSatisfactionSurveyMetrics(query);
    await this.logAccess(user, 'satisfaction', query);
    return result;
  }
}
