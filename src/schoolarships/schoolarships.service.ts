import { Injectable } from '@nestjs/common';
import { CreateSchoolarshipDto } from './dto/create-schoolarship.dto';
import { UpdateSchoolarshipDto } from './dto/update-schoolarship.dto';
import { CreateSchoolarshipUsersDto } from './dto/create-schoolarship-users.dto';
import { PrismaService } from 'src/prisma.service';
import { UpdateSchoolarshipUserDto } from './dto/update-schoolarship-users.dto';

@Injectable()
export class SchoolarshipsService {
  constructor(private prisma: PrismaService) { }

  async create(createSchoolarshipDto: CreateSchoolarshipDto) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: createSchoolarshipDto.categoryId }
      });
      if (!category) {
        throw new Error('Categoria no encontrada');
      }
    } catch (error) {
      throw new Error('Error al crear la beca: ');
    }
    return this.prisma.schoolarship.create({
      data: createSchoolarshipDto
    });
  }


  async createSchoolarshipUser(schoolarshipUserDto: CreateSchoolarshipUsersDto) {
    try {
      const schoolarship = await this.prisma.schoolarship.findUnique({
        where: { id: schoolarshipUserDto.schoolarshipId }
      });
      if (!schoolarship) {
        throw new Error('Beca no encontrada');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: schoolarshipUserDto.userId }
      });
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      return this.prisma.schoolarshipUser.create({
        data: {
          schoolarshipId: schoolarshipUserDto.schoolarshipId,
          userId: schoolarshipUserDto.userId
        }
      });
    } catch (error) {
      throw new Error('Error al asociar la beca al usuario');
    }

  }

  findAll() {
    return this.prisma.schoolarship.findMany();
  }

  findOne(id: string) {
    return this.prisma.schoolarship.findUnique({
      where: { id }
    });
  }

  findSchoolarshipsByCategory(categoryId: string) {
    return this.prisma.schoolarship.findMany({
      where: { categoryId }
    });
  }

  findSchoolarshipUsers(schoolarshipId: string) {
    return this.prisma.schoolarshipUser.findMany({
      where: { schoolarshipId },
      include: { user: true }
    });
  }

  update(id: string, updateSchoolarshipDto: UpdateSchoolarshipDto) {
    return this.prisma.schoolarship.update({
      where: { id },
      data: updateSchoolarshipDto
    });
  }

  updateSchoolarshipUser(schoolarshipUserId: string, updateSchoolarshipUserDto: UpdateSchoolarshipUserDto) {
    return this.prisma.schoolarshipUser.update({
      where: { id: schoolarshipUserId },
      data: {
        schoolarshipId: updateSchoolarshipUserDto.schoolarshipId,
        userId: updateSchoolarshipUserDto.userId
      }
    });
  }

  remove(id: string) {
    return this.prisma.schoolarship.delete({
      where: { id }
    });
  }
  removeSchoolarshipUser(schoolarshipUserId: string) {
    return this.prisma.schoolarshipUser.delete({
      where: { id: schoolarshipUserId }
    });
  }
}
