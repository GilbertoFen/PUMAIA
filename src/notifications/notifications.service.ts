import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene las preferencias de notificación del usuario autenticado (crea valores por defecto si no existen).
   */
  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        emailEnabled: true,
        classReminders: true,
      },
    });
  }

  /**
   * Actualiza las preferencias de notificación del usuario autenticado.
   */
  async updatePreferences(userId: string, dto: UpdatePreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        ...(dto.emailEnabled !== undefined && { emailEnabled: dto.emailEnabled }),
        ...(dto.classReminders !== undefined && { classReminders: dto.classReminders }),
      },
      create: {
        userId,
        emailEnabled: dto.emailEnabled ?? true,
        classReminders: dto.classReminders ?? true,
      },
    });
  }
}

