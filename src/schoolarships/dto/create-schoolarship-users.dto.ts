import { IsNotEmpty, IsUUID, IsOptional, IsDateString } from 'class-validator';

export class CreateSchoolarshipUsersDto {
  @IsUUID()
  @IsNotEmpty()
  schoolarshipId: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
