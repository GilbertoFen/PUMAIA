import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { MetricsService } from '../metrics.service';
import { JwtAuthGuard } from '../../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../../autenticacion/guards/roles.guard';
import { Roles } from '../../autenticacion/decorators/roles.decorator';
import { CurrentUser } from '../../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../../autenticacion/interfaces/auth-user.interface';
import { GenerateReportDto } from './reports.dto';

/**
 * Registro de reportes impresos del panel. El PDF se arma en el navegador con las mismas
 * cifras (ya agregadas y protegidas) que el panel; aquí solo se deja constancia en la bitácora
 * ANTES de imprimir: quién, qué sección y con qué filtros.
 */
@Controller('metrics/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN, RoleType.ANALYST)
export class ReportsController {
  constructor(
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
  ) {}

  @Post()
  @HttpCode(201)
  async generate(
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const generatedAt = new Date().toISOString();
    const filters = {
      periodId: dto.periodId ?? null,
      weeks: dto.weeks ?? null,
      kind: dto.kind ?? null,
    };
    await this.audit.log({
      actorType: 'ADMIN',
      actorId: user?.userId,
      action: 'REPORT_GENERATED',
      detail: {
        section: dto.section,
        filters,
        roles: user?.roles ?? [],
        minGroupSize: this.metrics.minGroup,
        generatedAt,
      },
    });
    return {
      section: dto.section,
      filters,
      generatedAt,
      generatedBy: { name: user?.name ?? null, email: user?.email ?? null },
      minGroupSize: this.metrics.minGroup,
    };
  }
}
