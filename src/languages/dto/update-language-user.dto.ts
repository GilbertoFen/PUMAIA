import { IsOptional, IsString } from 'class-validator';

export class UpdateLanguageUserDto {
  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsString()
  skillId?: string;
}