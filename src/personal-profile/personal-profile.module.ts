import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PersonalProfileService } from './personal-profile.service';
import { PersonalProfileController } from './personal-profile.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PersonalProfileController],
  providers: [PersonalProfileService],
  exports: [PersonalProfileService],
})
export class PersonalProfileModule {}

