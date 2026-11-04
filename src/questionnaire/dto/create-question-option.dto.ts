import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class CreateQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsInt()
  @Min(1)
  position: number;
}

