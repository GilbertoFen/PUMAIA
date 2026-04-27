import { Module } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { CertificationsController } from './certifications.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CertificationsController],
  providers: [CertificationsService, PrismaService],
})
export class CertificationsModule {}
