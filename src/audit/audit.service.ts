import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  actorType: 'ADMIN' | 'PROFESSOR' | 'STUDENT' | 'SYSTEM' | 'N8N';
  action: string;
  actorId?: string;
  detail?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento en la bitácora de auditoría (append-only).
   * Sanitiza cualquier campo que contenga contraseñas, secretos o tokens.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const sanitizedDetail = entry.detail ? this.sanitizeDetail(entry.detail) : undefined;

      await this.prisma.auditLog.create({
        data: {
          actorType: entry.actorType,
          actorId: entry.actorId || null,
          action: entry.action,
          detail: sanitizedDetail as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      // La auditoría no debe romper el flujo de negocio principal si la base falla,
      // pero debe quedar registrado en los logs del servidor.
      this.logger.error(`Error al registrar en AuditLog: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Consulta eventos de auditoría (solo lectura para administradores).
   */
  async findByActor(actorId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findRecent(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Remueve llaves sensibles para evitar persistir tokens, credenciales o contraseñas.
   * Maneja objetos anidados y arreglos recursivamente.
   */
  private sanitizeDetail(detail: any): any {
    if (detail === null || detail === undefined) return detail;

    if (Array.isArray(detail)) {
      return detail.map((item) => (typeof item === 'object' && item !== null ? this.sanitizeDetail(item) : item));
    }

    if (typeof detail !== 'object') {
      return detail;
    }

    const sensitivePatterns = [
      'password',
      'contrasena',
      'token',
      'accesstoken',
      'refreshtoken',
      'idtoken',
      'secret',
      'credencial',
      'authorization',
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(detail)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSensitive = sensitivePatterns.some((pattern) => normalizedKey.includes(pattern));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetail(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

