import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AdressesService } from './adresses.service';
import { CreateAdressDto } from './dto/create-adress.dto';
import { UpdateAdressDto } from './dto/update-adress.dto';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { CreateColoniaDto } from './dto/create-colonia.dto';
import { CreateMunicipioDto } from './dto/create-municipio.dto';
import { UpdateSpecDto } from './dto/update-estado.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { RolesGuard } from '../autenticacion/guards/roles.guard';
import { Roles } from '../autenticacion/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addresses')
export class AdressesController {
  constructor(private readonly adressesService: AdressesService) { }

  //POST
  @Post()
  create(@Body() createAdressDto: CreateAdressDto) {
    return this.adressesService.create(createAdressDto);
  }

  // Endpoints para crear estado, municipio y colonia
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post('estado')
  createEstado(@Body() createEstadoDto: CreateEstadoDto) {
    return this.adressesService.createEstado(createEstadoDto);
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post('estado/:estadoId/municipio')
  createMunicipio(@Body() createMunicipioDto: CreateMunicipioDto, @Param('estadoId') estadoId: string) {
    return this.adressesService.createMunicipio(createMunicipioDto);
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Post('municipio/:municipioId/colonia')
  createColonia(@Body() createColoniaDto: CreateColoniaDto, @Param('municipioId') municipioId: string) {
    return this.adressesService.createColonia(createColoniaDto);
  }

  // GET (solo admin puede listar el padrón completo de direcciones domiciliarias)
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Get()
  findAll() {
    return this.adressesService.findAll();
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adressesService.findOne(id);
  }

  @Get('/spec/estados')
  getEstados() {
    return this.adressesService.findAllEstados();
  }

  @Get('/spec/municipios')
  getMunicipios() {
    return this.adressesService.findAllMunicipios();
  }

  @Get('/spec/colonias')
  getColonias() {
    return this.adressesService.findAllColonias();
  }

  //PATCH
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAdressDto: UpdateAdressDto) {
    return this.adressesService.update(id, updateAdressDto);
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Patch('/spec/estado/:id')
  updateEstado(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateEstado(id, updateEstadoDto);
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Patch('/spec/municipio/:id')
  updateMunicipio(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateMunicipio(id, updateEstadoDto);
  }

  @Roles(RoleType.INSTITUTION_ADMIN)
  @Patch('/spec/colonia/:id')
  updateColonia(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateColonia(id, updateEstadoDto);
  }

  //DELETE
  @Roles(RoleType.INSTITUTION_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adressesService.remove(id);
  }
}
