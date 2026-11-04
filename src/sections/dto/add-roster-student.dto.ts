import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RosterOrigin, RosterStatus } from '@prisma/client';

export class AddRosterStudentDto {
  @IsInt()
  @IsNotEmpty()
  accountNumber: number;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsEnum(RosterOrigin)
  origin?: RosterOrigin;

  @IsOptional()
  @IsEnum(RosterStatus)
  status?: RosterStatus;
}

export class UploadRosterDto {
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddRosterStudentDto)
  students: AddRosterStudentDto[];
}

export class ConfirmRosterStudentDto {
  @IsOptional()
  @IsEnum(RosterStatus)
  status?: RosterStatus;

  @IsOptional()
  @IsUUID('4')
  linkedStudentId?: string;
}

export class ScheduleImportItemDto {
  @IsUUID('4')
  subjectId: string;

  @IsUUID('4')
  periodId: string;

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;
}

export class CreateScheduleImportDto {
  @IsOptional()
  @IsUUID('4')
  periodId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleImportItemDto)
  items?: ScheduleImportItemDto[];
}
