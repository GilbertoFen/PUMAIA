import { Injectable } from '@nestjs/common';
import { CreateAdressDto } from './dto/create-adress.dto';
import { UpdateAdressDto } from './dto/update-adress.dto';
import { PrismaService } from 'src/prisma.service';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { UpdateSpecDto } from './dto/update-estado.dto';

@Injectable()
export class AdressesService {

  constructor(private prisma: PrismaService) { }


  //CREATE
  async create(data: CreateAdressDto) {
    return this.prisma.address.create({ data });
  }

  async createEstado(createEstadoDto: CreateEstadoDto) {
    return this.prisma.estado.create({
      data: { name: createEstadoDto.name },
    });
  }

  async createMunicipio(data: CreateEstadoDto) {
    return this.prisma.municipio.create({ data });
  }

  async createColonia(data: CreateEstadoDto) {
    return this.prisma.colonia.create({ data });
  }

  //GET
  async findAllEstados() {
    return this.prisma.estado.findMany();
  }
  async findEstadoById(id: string) {
    return this.prisma.estado.findUnique({ where: { id } });
  }
  async findAllMunicipios() {
    return this.prisma.municipio.findMany();
  }
  async findMunicipioById(id: string) {
    return this.prisma.municipio.findUnique({ where: { id } });
  }
  async findAllColonias() {
    return this.prisma.colonia.findMany();
  }
  async findColoniaById(id: string) {
    return this.prisma.colonia.findUnique({ where: { id } });
  }

  async findAll() {
    return this.prisma.address.findMany();
  }

  findOne(id: string) {
    return this.prisma.address.findUnique({ where: { id } });
  }

  //UPDATE
  update(id: string, updateAdressDto: UpdateAdressDto) {
    return this.prisma.address.update({ where: { id }, data: updateAdressDto });
  }

  updateEstado(id: string, updateEstadoDto: UpdateSpecDto) {
    return this.prisma.estado.update({ where: { id }, data: { name: updateEstadoDto.name } });
  }
  updateMunicipio(id: string, updateEstadoDto: UpdateSpecDto) {
    return this.prisma.municipio.update({ where: { id }, data: { name: updateEstadoDto.name } });
  }
  updateColonia(id: string, updateEstadoDto: UpdateSpecDto) {
    return this.prisma.colonia.update({ where: { id }, data: { name: updateEstadoDto.name } });
  }

  //DELETE
  remove(id: string) {
    return this.prisma.address.delete({ where: { id } });
  }
}
