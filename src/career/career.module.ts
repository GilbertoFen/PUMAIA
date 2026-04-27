import { Module } from '@nestjs/common';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [CareerController],
  providers: [CareerService],
  imports: [PrismaModule],
})
export class CareerModule {}
