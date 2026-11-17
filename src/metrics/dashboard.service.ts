import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';
import { SectionContext } from './sections/context';
import { getSummary } from './sections/summary.section';
import { getAdoption } from './sections/adoption.section';
import { getPerformance } from './sections/performance.section';
import { getProgress } from './sections/progress.section';
import { getChat } from './sections/chat.section';
import { getAttendanceDashboard } from './sections/attendance.section';
import { getOperations } from './sections/operations.section';
import { DEFAULT_WEEKS } from './metrics.utils';

/** Una función por sección del dashboard de administración (ver src/metrics/sections). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  private ctx(): SectionContext {
    return {
      prisma: this.prisma,
      k: this.metrics.minGroup,
      metrics: this.metrics,
      now: new Date(),
    };
  }

  /** Periodos académicos, del más reciente al más antiguo, y cuál está en curso hoy. */
  async periods() {
    const now = new Date();
    const periods = await this.prisma.academicPeriod.findMany({
      select: { id: true, code: true, startsAt: true, endsAt: true },
      orderBy: [{ startsAt: 'desc' }, { code: 'desc' }],
    });
    const current = periods.find(
      (p) => p.startsAt && p.endsAt && p.startsAt <= now && p.endsAt >= now,
    );
    return this.metrics.envelope(
      {},
      periods.map((p) => ({ ...p, current: p.id === current?.id })),
      [
        'Sin periodo elegido, Resumen y Operación usan el periodo en curso (o todos si no hay uno en curso).',
      ],
    );
  }

  summary(filters: { periodId?: string } = {}) {
    return getSummary(this.ctx(), filters);
  }

  adoption(filters: { weeks?: number } = {}) {
    return getAdoption(this.ctx(), { weeks: filters.weeks ?? DEFAULT_WEEKS });
  }

  performance(filters: { periodId?: string } = {}) {
    return getPerformance(this.ctx(), filters);
  }

  progress() {
    return getProgress(this.ctx());
  }

  chat(filters: { weeks?: number } = {}) {
    return getChat(this.ctx(), { weeks: filters.weeks ?? DEFAULT_WEEKS });
  }

  attendance(filters: { weeks?: number; periodId?: string } = {}) {
    return getAttendanceDashboard(this.ctx(), {
      weeks: filters.weeks ?? DEFAULT_WEEKS,
      periodId: filters.periodId,
    });
  }

  operations(filters: { periodId?: string } = {}) {
    return getOperations(this.ctx(), filters);
  }

  questionnaires(
    filters: Parameters<MetricsService['getSatisfactionSurveyMetrics']>[0] = {},
  ) {
    return this.metrics.getSatisfactionSurveyMetrics(filters);
  }
}
