import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}


  async create(createSkillDto: CreateSkillDto) {
    try {
      const existing = await this.findSkillByProficiency(createSkillDto.proficiency);
      if (existing) {
        throw new BadRequestException('El nivel CEFR ya existe');
      }
      const validCEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validCEFR.includes(createSkillDto.proficiency)) {
        throw new BadRequestException('Nivel CEFR inválido. Usa A1, A2, B1, B2, C1 o C2');
      }
      console.log("creando habilidad con nivel: ", createSkillDto.proficiency);
      return this.prisma.skill.create({
        data: {
          proficiency: createSkillDto.proficiency,
        },
      });
    } catch (error) {
      throw new BadRequestException('Error al crear la habilidad');
    }
  }



  //GET

  async findAll() {
    const skills = await this.prisma.skill.findMany();
    const descriptions: Record<string, string> = {
      A1: 'Principiante',
      A2: 'Elemental',
      B1: 'Intermedio',
      B2: 'Intermedio Avanzado',
      C1: 'Avanzado',
      C2: 'Maestría Nativa',
      NATIVO: 'Hablante Nativo',
    };
    return skills.map((s) => ({
      ...s,
      name: descriptions[s.proficiency] || s.proficiency,
      label: `${s.proficiency} — ${descriptions[s.proficiency] || s.proficiency}`,
    }));
  }

  findOne(id: string) {
    return this.prisma.skill.findUnique({
      where: { id },
    });
  }

  findSkillByProficiency(proficiency: string) {
    return this.prisma.skill.findUnique({
      where: { proficiency },
    });
  }

  //UPDATE

  update(id: string, updateSkillDto: UpdateSkillDto) {
    return this.prisma.skill.update({
      where: { id },
      data: {
        proficiency: updateSkillDto.proficiency,
      },
    });
  }


  //DELETE

  remove(id: string) { 
    return this.prisma.skill.delete({
      where: { id },
    });
  }
}
