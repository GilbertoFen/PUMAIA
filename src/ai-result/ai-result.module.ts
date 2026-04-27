import { Module } from '@nestjs/common';
import { AIResultController } from './ai-result.controller';
import { AIResultService } from './ai-result.service';

@Module({
  controllers: [AIResultController],
  providers: [AIResultService]
})
export class AIResultModule {}
