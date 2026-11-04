import { IsOptional, IsString } from 'class-validator';

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  proficiency?: string; // A1, A2, B1, B2, C1, C2
}