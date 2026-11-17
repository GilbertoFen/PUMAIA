import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { QuestionnaireKind } from '@prisma/client';

/** Secciones del panel que se pueden imprimir. El etiquetado nunca se imprime. */
export const REPORT_SECTIONS = [
  'full',
  'summary',
  'academic',
  'attendance',
  'chat',
  'suggestions',
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export class GenerateReportDto {
  @IsIn(REPORT_SECTIONS, {
    message: `section debe ser uno de: ${REPORT_SECTIONS.join(', ')}`,
  })
  section: ReportSection;

  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weeks debe ser un entero' })
  @Min(1)
  @Max(52)
  weeks?: number;

  @IsOptional()
  @IsEnum(QuestionnaireKind)
  kind?: QuestionnaireKind;
}
