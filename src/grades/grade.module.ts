import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GradeService } from './grade.service';
import { GradeController } from './grade.controller';



@Module({
    controllers: [GradeController],
    providers: [GradeService],
    imports: [PrismaModule],
})
export class GradeModule {}
