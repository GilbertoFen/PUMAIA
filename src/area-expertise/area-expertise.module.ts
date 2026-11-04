import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AreasExpertiseController } from './area-expertise.controller';
import { AreasExpertiseService } from './area-expertise.service';

@Module({
  imports: [PrismaModule],
  controllers: [AreasExpertiseController],
  providers: [AreasExpertiseService],
  exports: [AreasExpertiseService],
})
export class AreaExpertiseModule {}
