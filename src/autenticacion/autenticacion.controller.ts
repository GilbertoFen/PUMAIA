import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode } from '@nestjs/common';
import { AutenticacionService } from './autenticacion.service';
import { CreateAutenticacionDto } from './dto/create-autenticacion.dto';

@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly autenticacionService: AutenticacionService) {}
  //create DTO!!!
  @HttpCode(200) 
  @Post('login')
  login (@Body() input: CreateAutenticacionDto) {
    return this.autenticacionService.autenticar(input);
  }
}
