import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

