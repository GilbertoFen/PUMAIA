import {
  IsEmail,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoleType } from '@prisma/client';

export class GoogleLoginDto {
  @IsString({ message: 'El idToken debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El idToken de Google es obligatorio' })
  idToken: string;

  @IsString()
  @IsOptional()
  careerId?: string;
}

export class DevLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El correo institucional es obligatorio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  careerId?: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class RegisterDto {
  @IsEmail(
    {},
    { message: 'El correo electrónico debe tener un formato válido.' },
  )
  @IsNotEmpty({ message: 'El correo institucional es obligatorio.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio.' })
  lastNameP: string;

  @IsString()
  @IsOptional()
  lastNameM?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  accountNumber?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  currentSemester?: number;

  @IsString()
  @IsOptional()
  careerId?: string;
}

export class LoginDto {
  @IsString()
  @IsOptional()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  accountNumber?: number;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El código o token de verificación es obligatorio.' })
  token: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  email: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El token de restablecimiento es obligatorio.' })
  token: string;

  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres.',
  })
  newPassword: string;
}

export class InviteStaffDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  lastNameP: string;

  @IsString()
  @IsOptional()
  lastNameM?: string;

  @IsEnum(RoleType)
  role: RoleType;

  // Rol PROFESSOR: id del profesor YA cargado en el sistema al que se liga esta cuenta
  @IsOptional()
  @IsUUID()
  professorId?: string;

  // Rol PROFESSOR: solo si de verdad es un profesor nuevo (evita duplicados)
  @IsOptional()
  @IsBoolean()
  createNewProfessor?: boolean;
}
