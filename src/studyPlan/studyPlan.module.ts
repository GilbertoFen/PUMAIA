import { Module } from '@nestjs/common';
import { StudyPlanService } from './studyPlan.service';
import { StudyPlanController } from './studyPlan.controller';
import { PrismaModule } from 'src/prisma/prisma.module';



@Module({
    controllers: [StudyPlanController],
    providers: [StudyPlanService],
    imports: [PrismaModule]
})
export class StudyPlanModule {}