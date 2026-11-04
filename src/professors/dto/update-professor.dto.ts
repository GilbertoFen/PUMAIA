import { IsString, IsOptional, IsInt, IsUUID, IsBoolean, Min } from 'class-validator';

export class UpdateProfessorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  lastNameP?: string;

  @IsOptional()
  @IsString()
  lastNameM?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  startYear?: number;

  @IsOptional()
  @IsUUID()
  academicCategoryId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
