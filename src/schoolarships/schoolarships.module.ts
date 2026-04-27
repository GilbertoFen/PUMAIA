import { Module } from '@nestjs/common';
import { SchoolarshipsService } from './schoolarships.service';
import { SchoolarshipsController } from './schoolarships.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SchoolarshipsController],
  providers: [SchoolarshipsService, PrismaService],
})
export class SchoolarshipsModule {}
