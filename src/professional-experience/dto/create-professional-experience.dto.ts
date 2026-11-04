import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateProfessionalExperienceDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsUUID()
  @IsNotEmpty()
  areaExpertiseId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string; 
}