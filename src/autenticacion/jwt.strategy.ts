import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { JwtPayload, AuthUser } from './interfaces/auth-user.interface';
import { resolveJwtSecret } from './jwt.secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(
    payload: JwtPayload & { tokenType?: string },
  ): Promise<AuthUser> {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException(
        'Token inválido: falta identificador de usuario.',
      );
    }
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException(
        'Un Refresh Token no puede ser utilizado como Access Token.',
      );
    }
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException(
        'Tipo de token no válido para autorización.',
      );
    }
    if (!payload.sid) {
      throw new UnauthorizedException('Token sin sesión asociada.');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { roles: true, student: true, professor: true },
    });

    if (!dbUser)
      throw new UnauthorizedException(
        'El usuario asociado al token ya no existe.',
      );
    if (dbUser.status !== UserStatus.ACTIVE || Boolean(dbUser.deletedAt)) {
      throw new UnauthorizedException(
        'La cuenta de usuario se encuentra inactiva, suspendida o eliminada.',
      );
    }

    const activeRoles = (dbUser.roles || []).map((r) => r.role);
    if (activeRoles.length === 0) {
      throw new UnauthorizedException(
        'El usuario no cuenta con roles ni permisos vigentes.',
      );
    }

    // La sesión DEBE existir, no estar revocada y no haber expirado
    const session = await (this.prisma as any).authSession.findUnique({
      where: { id: payload.sid },
    });
    if (
      !session ||
      session.userId !== dbUser.id ||
      session.revokedAt ||
      new Date(session.expiresAt) <= new Date()
    ) {
      throw new UnauthorizedException(
        'La sesión asociada a este token no es válida.',
      );
    }

    return {
      userId: dbUser.id,
      studentId: dbUser.student?.id ?? null,
      professorId: dbUser.professor?.id ?? null,
      sessionId: payload.sid,
      email: dbUser.email,
      name: `${dbUser.name} ${dbUser.lastNameP}`.trim(),
      roles: activeRoles,
      accountNumber: dbUser.student?.accountNumber ?? null,
    };
  }
}
