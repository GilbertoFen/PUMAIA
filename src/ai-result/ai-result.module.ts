import { Module } from '@nestjs/common';
import { AIResultController } from './ai-result.controller';
import { AIResultService } from './ai-result.service';
import { AICategoryModule } from 'src/ai-category/ai-category.module';
import { StudentsModule } from 'src/students/students.module';

@Module({
  imports: [
    AICategoryModule, 
    StudentsModule,   
  ],
  controllers: [AIResultController],
  providers: [AIResultService],
})
export class AIResultModule {}
