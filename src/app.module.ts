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

@Module({
  imports: [UsersModule, AdressesModule, AcademicModule, WorkModule, ExtrasModule, CareersModule, LanguagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
