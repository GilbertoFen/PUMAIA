import { Module } from '@nestjs/common';
import { AutenticacionService } from './autenticacion.service';
import { AutenticacionController } from './autenticacion.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'pumaia-default-secret-change-in-env',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '15m') as any,
        },
      }),
    }),
  ],
  controllers: [AutenticacionController],
  providers: [AutenticacionService, JwtStrategy, RolesGuard],
  exports: [AutenticacionService, JwtStrategy, RolesGuard, PassportModule, JwtModule],
})
export class AutenticacionModule {}
