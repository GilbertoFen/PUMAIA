import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdressesService } from './adresses.service';
import { CreateAdressDto } from './dto/create-adress.dto';
import { UpdateAdressDto } from './dto/update-adress.dto';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { CreateColoniaDto } from './dto/create-colonia.dto';
import { CreateMunicipioDto } from './dto/create-municipio.dto';
import { UpdateSpecDto } from './dto/update-estado.dto';

@Controller('addresses')
export class AdressesController {
  constructor(private readonly adressesService: AdressesService) { }

  //POST
  @Post()
  create(@Body() createAdressDto: CreateAdressDto) {
    return this.adressesService.create(createAdressDto);
  }

  // Endpoints para crear estado, municipio y colonia

  // Endpoint para crear un nuevo estado
  @Post('estado')
  createEstado(@Body() createEstadoDto: CreateEstadoDto) {
    return this.adressesService.createEstado(createEstadoDto);
  }

  // Endpoint para crear un nuevo municipio dentro de un estado específico
  @Post('estado/:estadoId/municipio')
  createMunicipio(@Body() createMunicipioDto: CreateMunicipioDto, @Param('estadoId') estadoId: string) {
    return this.adressesService.createMunicipio(createMunicipioDto);
  }

  // Endpoint para crear una nueva colonia dentro de un municipio específico
  @Post('municipio/:municipioId/colonia')
  createColonia(@Body() createColoniaDto: CreateColoniaDto, @Param('municipioId') municipioId: string) {
    return this.adressesService.createColonia(createColoniaDto);
  }

  // GET
  @Get()
  findAll() {
    return this.adressesService.findAll();
  }

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
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAdressDto: UpdateAdressDto) {
    return this.adressesService.update(id, updateAdressDto);
  }

  @Patch('/spec/estado/:id')
  updateEstado(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateEstado(id, updateEstadoDto);
  }
  @Patch('/spec/municipio/:id')
  updateMunicipio(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateMunicipio(id, updateEstadoDto);
  }
  @Patch('/spec/colonia/:id')
  updateColonia(@Param('id') id: string, @Body() updateEstadoDto: UpdateSpecDto) {
    return this.adressesService.updateColonia(id, updateEstadoDto);
  }

  //DELETE
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adressesService.remove(id);
  }
}
