import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlumnosModule } from './alumnos/alumnos.module';
import { AdressesModule } from './adresses/adresses.module';
import { LanguagesModule } from './languages/languages.module';
import { AutenticacionModule } from './autenticacion/autenticacion.module';
import { ConfigModule } from '@nestjs/config';
import { SkillsModule } from './skills/skills.module';
import { CertificationsModule } from './certifications/certifications.module';
import { SchoolarshipsModule } from './schoolarships/schoolarships.module';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [AlumnosModule, AdressesModule, LanguagesModule, AutenticacionModule, ConfigModule.forRoot({isGlobal: true}), SkillsModule, CertificationsModule, SchoolarshipsModule, CoursesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
