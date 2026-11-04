import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PersonalProfileService } from './personal-profile.service';
import { UpdatePersonalProfileDto } from './dto/update-personal-profile.dto';
import { CreateContactMethodDto } from './dto/create-contact-method.dto';
import { UpdateContactMethodDto } from './dto/update-contact-method.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

@Controller('personal-profile')
@UseGuards(JwtAuthGuard)
export class PersonalProfileController {
  constructor(private readonly service: PersonalProfileService) {}

  @Get('me')
  async getMyProfile(@CurrentUser() user: AuthUser) {
    return this.service.getMyProfile(user.userId);
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePersonalProfileDto,
  ) {
    return this.service.updateMyProfile(user.userId, dto);
  }

  @Get('contacts')
  async getMyContactMethods(@CurrentUser() user: AuthUser) {
    return this.service.getContactMethods(user.userId);
  }

  @Post('contacts')
  async addContactMethod(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateContactMethodDto,
  ) {
    return this.service.addContactMethod(user.userId, dto);
  }

  @Patch('contacts/:id')
  async updateContactMethod(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateContactMethodDto,
  ) {
    return this.service.updateContactMethod(id, user.userId, dto);
  }

  @Delete('contacts/:id')
  async removeContactMethod(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.removeContactMethod(id, user.userId);
  }
}

