import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SchoolarshipsService } from './schoolarships.service';
import { CreateSchoolarshipDto } from './dto/create-schoolarship.dto';
import { UpdateSchoolarshipDto } from './dto/update-schoolarship.dto';
import { CreateSchoolarshipUsersDto } from './dto/create-schoolarship-users.dto';
import { UpdateSchoolarshipUserDto } from './dto/update-schoolarship-users.dto';

@Controller('schoolarships')
export class SchoolarshipsController {
  constructor(private readonly schoolarshipsService: SchoolarshipsService) { }

  @Post()
  create(@Body() dto: CreateSchoolarshipDto) {
    return this.schoolarshipsService.create(dto);
  }

  @Get()
  findAll() {
    return this.schoolarshipsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolarshipsService.findOne(id);
  }

  @Get('category/:categoryId')
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.schoolarshipsService.findSchoolarshipsByCategory(categoryId);
  }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolarshipDto
  ) {
    return this.schoolarshipsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schoolarshipsService.remove(id);
  }
  @Post('assign')
  createSchoolarshipUser(@Body() dto: CreateSchoolarshipUsersDto) {
    return this.schoolarshipsService.createSchoolarshipUser(dto);
  }

  @Get(':id/users')
  findUsers(@Param('id') id: string) {
    return this.schoolarshipsService.findSchoolarshipUsers(id);
  }


  @Patch('assign/:id')
  updateSchoolarshipUser(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolarshipUserDto
  ) {
    return this.schoolarshipsService.updateSchoolarshipUser(id, dto);
  }

  @Delete('assign/:id')
  removeSchoolarshipUser(@Param('id') id: string) {
    return this.schoolarshipsService.removeSchoolarshipUser(id);
  }
}
