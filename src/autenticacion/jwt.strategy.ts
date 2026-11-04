import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { JwtPayload, AuthUser } from './interfaces/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'pumaia-default-secret-change-in-env',
    });
  }

  async validate(payload: JwtPayload & { tokenType?: string }): Promise<AuthUser> {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException('Token inválido: falta identificador de usuario.');
    }

    // Regla de seguridad estricta: un refresh token no puede utilizarse como access token
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException('Un Refresh Token no puede ser utilizado como Access Token.');
    }

    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Tipo de token no válido para autorización.');
    }

    // Validar estado actual del usuario, sesión y roles vigentes en la base de datos
    if (this.prisma?.user?.findUnique) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        include: {
          roles: true,
          student: true,
          professor: true,
        },
      });

      if (!dbUser) {
        throw new UnauthorizedException('El usuario asociado al token ya no existe.');
      }

      if (dbUser.status !== UserStatus.ACTIVE || Boolean(dbUser.deletedAt)) {
        throw new UnauthorizedException('La cuenta de usuario se encuentra inactiva, suspendida o eliminada.');
      }

      const activeRoles = (dbUser.roles || []).map((r) => r.role);
      if (activeRoles.length === 0) {
        throw new UnauthorizedException('El usuario no cuenta con roles ni permisos vigentes.');
      }

      if (payload.sid && (this.prisma as any).authSession?.findUnique) {
        const session = await (this.prisma as any).authSession.findUnique({
          where: { id: payload.sid },
        });
        if (session && Boolean(session.revokedAt)) {
          throw new UnauthorizedException('La sesión asociada a este token fue revocada.');
        }
      }

      return {
        userId: dbUser.id,
        studentId: dbUser.student?.id ?? payload.studentId ?? null,
        professorId: dbUser.professor?.id ?? payload.professorId ?? null,
        sessionId: payload.sid ?? null,
        email: dbUser.email,
        name: `${dbUser.name} ${dbUser.lastNameP}`.trim(),
        roles: activeRoles,
        accountNumber: dbUser.student?.accountNumber ?? payload.accountNumber ?? null,
      };
    }

    return {
      userId: payload.userId,
      studentId: payload.studentId,
      professorId: payload.professorId ?? null,
      sessionId: payload.sid ?? null,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      accountNumber: payload.accountNumber,
    };
  }
}
