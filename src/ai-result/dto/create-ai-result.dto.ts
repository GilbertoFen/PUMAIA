import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAIResultDto {
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsString() @IsNotEmpty() optionA!: string;
  @IsString() @IsNotEmpty() descriptionA!: string;

  @IsString() @IsNotEmpty() optionB!: string;
  @IsString() @IsNotEmpty() descriptionB!: string;

  @IsString() @IsNotEmpty() optionC!: string;
  @IsString() @IsNotEmpty() descriptionC!: string;

  @IsString() @IsNotEmpty() optionD!: string;
  @IsString() @IsNotEmpty() descriptionD!: string;

  @IsString() @IsNotEmpty() optionE!: string;
  @IsString() @IsNotEmpty() descriptionE!: string;
}