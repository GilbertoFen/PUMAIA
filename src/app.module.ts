import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AdressesModule } from './adresses/adresses.module';
import { AcademicModule } from './academic/academic.module';
import { WorkModule } from './work/work.module';
import { ExtrasModule } from './extras/extras.module';
import { CareersModule } from './careers/careers.module';
import { LanguagesModule } from './languages/languages.module';
import { StudentsModule } from './students/students.module';
import { PrismaModule } from './prisma/prisma.module';
import {ConfigModule} from "@nestjs/config";
import { ContestModule } from './contest/contest.module';
import { AreasExpertiseController } from './area-expertise/area-expertise.controller';
import { AreasExpertiseService } from './area-expertise/area-expertise.service';
import { AreaExpertiseModule } from './area-expertise/area-expertise.module';
import { ProfessionalExperienceModule } from './professional-experience/professional-experience.module';
import { AIResultModule } from './ai-result/ai-result.module';
import { AICategoryModule } from './ai-category/ai-category.module';
@Module({
  imports: [ConfigModule.forRoot({isGlobal: true}), UsersModule, AdressesModule, AcademicModule, WorkModule, ExtrasModule, CareersModule, LanguagesModule, StudentsModule, PrismaModule, ContestModule, AreaExpertiseModule, ProfessionalExperienceModule, AIResultModule, AICategoryModule],
  controllers: [AppController, AreasExpertiseController],
  providers: [AppService, AreasExpertiseService],

})
export class AppModule {}
