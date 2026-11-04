import { IsString, IsInt, IsNotEmpty, Min, Max, IsOptional, IsNumber, IsEmail } from 'class-validator';

export class CreateStudentDto {
  @IsInt()
  @IsNotEmpty({ message: 'El número de cuenta es obligatorio' })
  @Min(10000, { message: 'El número de cuenta debe tener al menos 5 dígitos' })
  @Max(999999999, { message: 'El número de cuenta no puede superar los 9 dígitos' })
  accountNumber: number;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  lastNameP: string;

  @IsString()
  @IsOptional()
  lastNameM?: string;

  @IsString()
  @IsOptional()
  interest?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  currentSemester?: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  average?: number;

  @IsEmail({}, { message: 'Debe ser un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @IsString()
  @IsOptional()
  careerId?: string;

  @IsString()
  @IsOptional()
  addressId?: string;
}
