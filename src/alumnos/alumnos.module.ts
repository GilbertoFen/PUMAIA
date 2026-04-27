import { Module } from '@nestjs/common';
import { AlumnosService } from './alumnos.service';
import { AlumnosController } from './alumnos.controller';
import { PrismaService } from 'src/prisma.service';

@Module({ 
  controllers: [AlumnosController],
  providers: [AlumnosService, PrismaService],
  exports: [AlumnosService]
})
export class AlumnosModule {}
