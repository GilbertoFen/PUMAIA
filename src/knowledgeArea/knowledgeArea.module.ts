import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { KnowledgeAreaService } from './knowledgeArea.service';
import { KnowledgeAreaController } from './knowledgeArea.controller';



@Module({
    controllers: [KnowledgeAreaController],
    providers: [KnowledgeAreaService],
    imports: [PrismaModule],
})
export class KnowledgeAreaModule {}
