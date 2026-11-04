import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// INFRAESTRUCTURA Y TRANSVERSALES
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { ConsentsModule } from './consents/consents.module';
import { AutenticacionModule } from './autenticacion/autenticacion.module';

// ALUMNOS Y EXPEDIENTE
import { StudentsModule } from './students/students.module';
import { CareerModule } from './career/career.module';
import { StudentCareerModule } from './students-career/studentCareer.module';
import { SubjectModule } from './subject/subject.module';
import { GradeModule } from './grades/grade.module';
import { StudyPlanModule } from './studyPlan/studyPlan.module';
import { CategoryModule } from './category/category.module';
import { KnowledgeAreaModule } from './knowledgeArea/knowledgeArea.module';

// ACTIVIDADES, CURSOS Y PERFIL
import { CoursesModule } from './courses/courses.module';
import { CertificationsModule } from './certifications/certifications.module';
import { LanguagesModule } from './languages/languages.module';
import { SkillsModule } from './skills/skills.module';
import { SchoolarshipsModule } from './schoolarships/schoolarships.module';
import { ContestModule } from './contest/contest.module';
import { AreaExpertiseModule } from './area-expertise/area-expertise.module';
import { ProfessionalExperienceModule } from './professional-experience/professional-experience.module';
import { AdressesModule } from './adresses/adresses.module';

// ASISTENTE DE IA Y CUESTIONARIOS
import { ChatModule } from './chat/chat.module';
import { AIResultModule } from './ai-result/ai-result.module';
import { AICategoryModule } from './ai-category/ai-category.module';
import { QuestionnaireModule } from './questionnaire/questionnaire.module';

// GESTIÓN ACADÉMICA, ASISTENCIA Y CONOCIMIENTO RAG
import { SectionsModule } from './sections/sections.module';
import { AttendanceModule } from './attendance/attendance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { KnowledgeDocumentsModule } from './knowledge-documents/knowledge-documents.module';

// VISTAS Y MÉTRICAS INSTITUCIONALES (DASHBOARD)
import { MetricsModule } from './metrics/metrics.module';

// CUERPO DOCENTE, PERFIL PERSONAL Y SALUD OPERATIVA
import { ProfessorsModule } from './professors/professors.module';
import { PersonalProfileModule } from './personal-profile/personal-profile.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    ConsentsModule,
    AutenticacionModule,

    StudentsModule,
    CareerModule,
    StudentCareerModule,
    SubjectModule,
    GradeModule,
    StudyPlanModule,
    CategoryModule,
    KnowledgeAreaModule,

    CoursesModule,
    CertificationsModule,
    LanguagesModule,
    SkillsModule,
    SchoolarshipsModule,
    ContestModule,
    AreaExpertiseModule,
    ProfessionalExperienceModule,
    AdressesModule,

    ChatModule,
    AIResultModule,
    AICategoryModule,
    QuestionnaireModule,

    SectionsModule,
    AttendanceModule,
    NotificationsModule,
    KnowledgeDocumentsModule,
    MetricsModule,

    ProfessorsModule,
    PersonalProfileModule,
    HealthModule,
  ],
})
export class AppModule {}
