import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateStudyDto {
  @IsString()
  @IsNotEmpty()
  degree: string;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  year?: number;
}
