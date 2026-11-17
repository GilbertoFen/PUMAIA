import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { LabelingService } from './labeling/labeling.service';
import { LabelingController } from './labeling/labeling.controller';
import { ReportsController } from './reports/reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    MetricsController,
    DashboardController,
    LabelingController,
    ReportsController,
  ],
  providers: [MetricsService, DashboardService, LabelingService],
  exports: [MetricsService],
})
export class MetricsModule {}
