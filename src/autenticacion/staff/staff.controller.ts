import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { StaffService } from './staff.service';
import { AutenticacionService } from '../autenticacion.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthUser } from '../interfaces/auth-user.interface';

export class ProfessorSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

/** Personal e invitaciones. Solo INSTITUTION_ADMIN. La invitación es POST /autenticacion/invite-staff. */
@Controller('autenticacion/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.INSTITUTION_ADMIN)
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly auth: AutenticacionService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user.userId);
  }

  @Get('professors-without-account')
  professorsWithoutAccount(
    @Query() query: ProfessorSearchQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staff.professorsWithoutAccount(user.userId, query.q);
  }

  /** Reenvía el correo de invitación. Solo si la persona sigue INVITED (si no, 409). */
  @Post(':userId/resend-invitation')
  @HttpCode(200)
  resendInvitation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auth.resendStaffInvitation(userId, user.userId);
  }
}
