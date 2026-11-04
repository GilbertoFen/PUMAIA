import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Visibility } from '@prisma/client';

export class UpdateContactMethodDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

