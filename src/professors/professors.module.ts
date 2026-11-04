import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessorsService } from './professors.service';
import { ProfessorsController } from './professors.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProfessorsController],
  providers: [ProfessorsService],
  exports: [ProfessorsService],
})
export class ProfessorsModule {}

