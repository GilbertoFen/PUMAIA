import { Module } from '@nestjs/common';
import { AutenticacionService } from './autenticacion.service';
import { AutenticacionController } from './autenticacion.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {JwtStrategy} from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { StudentsModule } from 'src/students/students.module';

@Module({
  controllers: [AutenticacionController],
  providers: [AutenticacionService, JwtStrategy],
  imports: [
    StudentsModule,
    PassportModule, 
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') as string,
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') as any,
        },
      }),
    }),
  ],
})
export class AutenticacionModule {}
