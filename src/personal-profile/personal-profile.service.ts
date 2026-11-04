import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePersonalProfileDto } from './dto/update-personal-profile.dto';
import { CreateContactMethodDto } from './dto/create-contact-method.dto';
import { UpdateContactMethodDto } from './dto/update-contact-method.dto';
import { Visibility } from '@prisma/client';

@Injectable()
export class PersonalProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el perfil personal del usuario autenticado (crea registro por defecto si no existe).
   */
  async getMyProfile(userId: string) {
    return this.prisma.personalProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Actualiza el perfil personal del usuario autenticado.
   */
  async updateMyProfile(userId: string, dto: UpdatePersonalProfileDto) {
    return this.prisma.personalProfile.upsert({
      where: { userId },
      update: {
        ...(dto.preferredName !== undefined && { preferredName: dto.preferredName?.trim() || null }),
        ...(dto.birthDay !== undefined && { birthDay: dto.birthDay }),
        ...(dto.birthMonth !== undefined && { birthMonth: dto.birthMonth }),
        ...(dto.aboutMe !== undefined && { aboutMe: dto.aboutMe?.trim() || null }),
      },
      create: {
        userId,
        preferredName: dto.preferredName?.trim() || null,
        birthDay: dto.birthDay || null,
        birthMonth: dto.birthMonth || null,
        aboutMe: dto.aboutMe?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            lastNameP: true,
            lastNameM: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene los métodos de contacto del usuario.
   */
  async getContactMethods(userId: string) {
    return this.prisma.contactMethod.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { type: 'asc' }],
    });
  }

  /**
   * Agrega un método de contacto al usuario autenticado.
   */
  async addContactMethod(userId: string, dto: CreateContactMethodDto) {
    return this.prisma.$transaction(async (tx) => {
      // Si se marca como principal, desmarcar otros del mismo tipo
      if (dto.isPrimary) {
        await tx.contactMethod.updateMany({
          where: { userId, type: dto.type },
          data: { isPrimary: false },
        });
      }

      return tx.contactMethod.create({
        data: {
          userId,
          type: dto.type,
          label: dto.label?.trim() || null,
          value: dto.value.trim(),
          visibility: dto.visibility || Visibility.PRIVATE,
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });
  }

  /**
   * Actualiza un método de contacto validando propiedad del usuario.
   */
  async updateContactMethod(id: string, userId: string, dto: UpdateContactMethodDto) {
    const existing = await this.prisma.contactMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Método de contacto no encontrado.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('No tienes autorización para modificar este método de contacto.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contactMethod.updateMany({
          where: { userId, type: existing.type },
          data: { isPrimary: false },
        });
      }

      return tx.contactMethod.update({
        where: { id },
        data: {
          ...(dto.label !== undefined && { label: dto.label?.trim() || null }),
          ...(dto.value !== undefined && { value: dto.value.trim() }),
          ...(dto.visibility !== undefined && { visibility: dto.visibility }),
          ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        },
      });
    });
  }

  /**
   * Elimina un método de contacto validando propiedad del usuario.
   */
  async removeContactMethod(id: string, userId: string) {
    const existing = await this.prisma.contactMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Método de contacto no encontrado.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('No tienes autorización para eliminar este método de contacto.');
    }

    return this.prisma.contactMethod.delete({
      where: { id },
    });
  }
}

