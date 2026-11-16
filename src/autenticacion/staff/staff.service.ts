import { Injectable } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

export const STAFF_ROLES: RoleType[] = [
  RoleType.PROFESSOR,
  RoleType.INSTITUTION_ADMIN,
  RoleType.ANALYST,
];

const PROFESSOR_SEARCH_LIMIT = 20;

/**
 * Consulta del personal (profesores, administradores y analistas) para la pestaña
 * "Personal e invitaciones". Las altas se hacen con AutenticacionService.inviteStaffMember.
 * Nunca incluye alumnos. Cada consulta queda en la bitácora.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actorId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: { not: UserStatus.DELETED },
        roles: { some: { role: { in: STAFF_ROLES } } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        lastNameP: true,
        lastNameM: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        roles: { select: { role: true, grantedAt: true } },
        professor: { select: { id: true } },
      },
      orderBy: [{ lastNameP: 'asc' }, { name: 'asc' }],
    });

    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'STAFF_LIST_VIEWED',
      detail: { count: users.length },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      lastNameP: u.lastNameP,
      lastNameM: u.lastNameM,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      // Solo roles de personal: si alguien también es alumno no se expone aquí.
      roles: u.roles
        .filter((r) => STAFF_ROLES.includes(r.role))
        .map((r) => r.role),
      invitedAt: u.roles
        .filter((r) => STAFF_ROLES.includes(r.role))
        .reduce<Date | null>(
          (min, r) => (!min || r.grantedAt < min ? r.grantedAt : min),
          null,
        ),
      professorId: u.professor?.id ?? null,
    }));
  }

  /** Profesores activos del catálogo que todavía no tienen cuenta (para ligar en la invitación). */
  async professorsWithoutAccount(actorId: string, q?: string) {
    const term = q?.trim();
    const where = {
      userId: null,
      active: true,
      ...(term && {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { lastNameP: { contains: term, mode: 'insensitive' as const } },
          { lastNameM: { contains: term, mode: 'insensitive' as const } },
        ],
      }),
    };
    const professors = await this.prisma.professor.findMany({
      where,
      select: { id: true, name: true, lastNameP: true, lastNameM: true },
      orderBy: [{ lastNameP: 'asc' }, { name: 'asc' }],
      take: PROFESSOR_SEARCH_LIMIT,
    });

    await this.audit.log({
      actorType: 'ADMIN',
      actorId,
      action: 'STAFF_PROFESSORS_SEARCHED',
      detail: { q: term ?? null, results: professors.length },
    });

    return professors;
  }
}
