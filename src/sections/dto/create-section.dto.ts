import { IsUUID, IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';

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
  joinCode?: string;

  @IsOptional()
  @IsUUID()
  professorId?: string;
}

