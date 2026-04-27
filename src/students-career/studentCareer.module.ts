import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StudentCareerService } from './studentCareer.service';
import { StudentCareerController } from './studentCareer.controller';

@Module({
  controllers: [StudentCareerController],
  providers: [StudentCareerService],
  imports: [PrismaModule],
})
export class StudentCareerModule {}
