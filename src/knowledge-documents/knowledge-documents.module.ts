import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeDocumentsController],
  providers: [KnowledgeDocumentsService],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}

