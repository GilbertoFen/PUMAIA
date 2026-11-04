import { IsEnum, IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ContactType, Visibility } from '@prisma/client';

export class CreateContactMethodDto {
  @IsEnum(ContactType)
  @IsNotEmpty()
  type: ContactType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

