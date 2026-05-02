import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional, IsNumber } from 'class-validator';

export class CreateStudentDto {
  @IsInt()
  @IsNotEmpty()
  @Min(100000000)
  @Max(999999999)
  accountNumber!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  lastNameP!: string;

  @IsString()
  @IsNotEmpty()
  lastNameM!: string;

  @IsString()
  @IsOptional()
  interest?: string;

  @IsInt()
  @Min(1)
  @Max(15)
  currentSemester!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  average!: number;
  
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}