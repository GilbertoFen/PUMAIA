import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.service.getPreferences(user.userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.service.updatePreferences(user.userId, dto);
  }
}

