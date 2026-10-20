import { Module } from '@nestjs/common';
import { AdressesService } from './adresses.service';
import { AdressesController } from './adresses.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AdressesController],
  providers: [AdressesService, PrismaService],
})
export class AdressesModule {}
