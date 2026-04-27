import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LanguagesService } from './languages.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { UpdateLanguageUserDto } from './dto/update-language-user.dto';
import { CreateLanguageUserDto } from './dto/create-language-user.dto';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /*
  POST
  */

  @Post()
  create(@Body() createLanguageDto: CreateLanguageDto) {
    return this.languagesService.createLanguage(createLanguageDto);
  }

  @Post('languageUsers')
  createLanguageUser(@Body() createLanguageUserDto: CreateLanguageUserDto) {
    return this.languagesService.createLanguageUser(createLanguageUserDto);
  }

  /*
  GET
  */

  @Get()
  findAll() {
    return this.languagesService.findAllLanguages();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.languagesService.findOneLanguage(id);
  }

  @Get('languageUsers')
  findLanguageUsers() {
    return this.languagesService.findLanguageUsers();
  }

  @Get('languageUsers/user/:userId')
  findLanguageUsersByUserId(@Param('userId') userId: string) {
    return this.languagesService.findLanguageUsersByUserId(userId);
  }

  /*
  PATCH
  */

  @Patch('languageUsers/:id')
  updateLanguageUser(@Param('id') id: string, @Body() updateLanguageUserDto: UpdateLanguageUserDto) {
    return this.languagesService.updateLanguageUser(id, updateLanguageUserDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLanguageDto: UpdateLanguageDto) {
    return this.languagesService.updateLanguage(id, updateLanguageDto);
  }
  

  /*
  DELETE
  */

  @Delete('languageUsers/:id')
  removeLanguageUser(@Param('id') id: string) {
    return this.languagesService.removeLanguageUser(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.languagesService.removeLanguage(id);
  }
}
