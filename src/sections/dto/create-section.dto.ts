import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateSectionDto {
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  periodId: string;

  @IsString()
  @IsNotEmpty()
  groupCode: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  joinCode?: string;

  @IsOptional()
  @IsUUID()
  professorId?: string;
}
