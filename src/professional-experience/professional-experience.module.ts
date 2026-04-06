import { Module } from '@nestjs/common';
import { ProfessionalExperienceService } from './professional-experience.service';
import { ProfessionalExperienceController } from './professional-experience.controller';

@Module({
  providers: [ProfessionalExperienceService],
  controllers: [ProfessionalExperienceController]
})
export class ProfessionalExperienceModule {}
