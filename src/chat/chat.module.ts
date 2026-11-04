import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentsModule } from '../consents/consents.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, ConsentsModule, AuditModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
