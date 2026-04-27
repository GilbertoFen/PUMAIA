import { IsUUID, IsNotEmpty, IsString } from 'class-validator';

export class CreateProfessionalExperienceDto {
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @IsUUID()
  @IsNotEmpty()
  areaExpertiseId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string; 
}