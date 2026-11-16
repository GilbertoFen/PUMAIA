import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { MetricsService } from './metrics.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';
import {
  PeriodQueryDto,
  SatisfactionQueryDto,
  WeeksPeriodQueryDto,
  WeeksQueryDto,
} from './dto/metrics-query.dto';

/** Un endpoint por sección del dashboard de administración. Solo agregados. */
@Controller('metrics/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
  ) {}

  /** Ejecuta la consulta y la deja en la bitácora (quién, qué sección, con qué filtros). */
  private async run<T>(
    user: AuthUser | null,
    section: string,
    filters: object,
    query: () => Promise<T>,
  ): Promise<T> {
    const result = await query();
    await this.audit.log({
      actorType: 'ADMIN',
      actorId: user?.userId,
      action: 'METRICS_VIEWED',
      detail: {
        endpoint: `dashboard/${section}`,
        filters,
        roles: user?.roles ?? [],
        minGroupSize: this.metrics.minGroup,
      },
    });
    return result;
  }

  /** Catálogo de periodos para el selector del panel (sin datos de alumnos). */
  @Get('periods')
  periods(@CurrentUser() user: AuthUser) {
    return this.run(user, 'periods', {}, () => this.dashboard.periods());
  }

  @Get('summary')
  summary(@Query() q: PeriodQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'summary', q, () => this.dashboard.summary(q));
  }

  @Get('adoption')
  adoption(@Query() q: WeeksQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'adoption', q, () => this.dashboard.adoption(q));
  }

  @Get('performance')
  performance(@Query() q: PeriodQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'performance', q, () =>
      this.dashboard.performance(q),
    );
  }

  @Get('progress')
  progress(@CurrentUser() user: AuthUser) {
    return this.run(user, 'progress', {}, () => this.dashboard.progress());
  }

  @Get('chat')
  chat(@Query() q: WeeksQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'chat', q, () => this.dashboard.chat(q));
  }

  @Get('questionnaires')
  questionnaires(
    @Query() q: SatisfactionQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.run(user, 'questionnaires', q, () =>
      this.dashboard.questionnaires(q),
    );
  }

  @Get('attendance')
  attendance(@Query() q: WeeksPeriodQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'attendance', q, () => this.dashboard.attendance(q));
  }

  @Get('operations')
  operations(@Query() q: PeriodQueryDto, @CurrentUser() user: AuthUser) {
    return this.run(user, 'operations', q, () => this.dashboard.operations(q));
  }
}
