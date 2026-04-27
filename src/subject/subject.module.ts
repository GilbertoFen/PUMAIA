import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';



@Module({
    controllers: [SubjectController],
    providers: [SubjectService],
    imports: [PrismaModule],
})
export class SubjectModule {}
