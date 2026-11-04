import { IsUUID, IsOptional, IsNotEmpty, IsString } from 'class-validator';

export class CreateLanguageUserDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsUUID()
  @IsNotEmpty()
  languageId: string;

  @IsString()
  @IsNotEmpty()
  skillId: string;
}