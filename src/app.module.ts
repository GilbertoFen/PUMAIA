import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

//GILBERTO
//import { AcademicModule } from './academic/academic.module';
//import { WorkModule } from './work/work.module';
//import { ExtrasModule } from './extras/extras.module';
//import { LanguagesModule } from './languages/languages.module';
import { StudentsModule } from './students/students.module';
import { PrismaModule } from './prisma/prisma.module';
import { ContestModule } from './contest/contest.module';
import { AreasExpertiseController } from './area-expertise/area-expertise.controller';
import { AreasExpertiseService } from './area-expertise/area-expertise.service';
import { AreaExpertiseModule } from './area-expertise/area-expertise.module';
import { ProfessionalExperienceModule } from './professional-experience/professional-experience.module';
import { AIResultModule } from './ai-result/ai-result.module';
import { AICategoryModule } from './ai-category/ai-category.module';

//SAUL
import { KnowledgeAreaModule } from './knowledgeArea/knowledgeArea.module';
import { StudyPlanModule } from './studyPlan/studyPlan.module';
import { CategoryModule } from './category/category.module';
import { SubjectModule } from './subject/subject.module';
import { GradeModule } from './grades/grade.module';
import { CareerModule } from './career/career.module';
import { StudentCareerModule } from './students-career/studentCareer.module';

//RACIEL
//import { AppController } from './app.controller';
//import { AppService } from './app.service';
import { AlumnosModule } from './alumnos/alumnos.module';
import { AdressesModule } from './adresses/adresses.module';
import { LanguagesModule } from './languages/languages.module';
import { AutenticacionModule } from './autenticacion/autenticacion.module';
import { SkillsModule } from './skills/skills.module';
import { CertificationsModule } from './certifications/certifications.module';
import { SchoolarshipsModule } from './schoolarships/schoolarships.module';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StudentsModule,
    AdressesModule,
    //AcademicModule,
    //WorkModule,
    //ExtrasModule,
    LanguagesModule,
    StudentsModule,
    PrismaModule,
    ContestModule,
    AreaExpertiseModule,
    ProfessionalExperienceModule,
    AIResultModule,
    AICategoryModule,

    KnowledgeAreaModule,
    StudyPlanModule,
    CategoryModule,
    SubjectModule,
    GradeModule,
    CareerModule,
    StudentCareerModule,

    AlumnosModule, 
    AdressesModule, 
    LanguagesModule, 
    AutenticacionModule, 
    SkillsModule, 
    CertificationsModule, 
    SchoolarshipsModule, 
    CoursesModule
  ],
  controllers: [AreasExpertiseController, //AppController
  ],
  providers: [AreasExpertiseService, //AppService

  ],

})
export class AppModule {}
