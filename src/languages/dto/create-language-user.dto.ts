import { IsEnum, IsUUID } from 'class-validator';
import { CefrLevel } from 'src/common/enums/cefr-level.enum';

export class CreateLanguageUserDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  languageId: string;

  @IsUUID()
  skillId: string;
}