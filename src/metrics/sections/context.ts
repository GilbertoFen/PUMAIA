import { PrismaService } from '../../prisma/prisma.service';
import type { MetricsService } from '../metrics.service';

/** Lo que necesita cada sección del dashboard. */
export interface SectionContext {
  prisma: PrismaService;
  /** Umbral mínimo de alumnos únicos (METRICS_MIN_GROUP). */
  k: number;
  metrics: MetricsService;
  now: Date;
}
