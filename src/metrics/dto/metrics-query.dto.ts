import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionnaireKind } from '@prisma/client';

/**
 * Filtros de los endpoints de métricas. Todos opcionales y validados:
 * un UUID mal formado o un `kind` fuera del enum devuelven 400 (antes daban 500).
 * Con `whitelist: true` en el ValidationPipe global, cualquier otro parámetro se descarta.
 */
export class AcademicPerformanceQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'careerId debe ser un UUID válido' })
  careerId?: string;
}

export class RetentionRiskQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'careerId debe ser un UUID válido' })
  careerId?: string;
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;

  @IsOptional()
  @IsUUID('all', { message: 'subjectId debe ser un UUID válido' })
  subjectId?: string;
}

export class SatisfactionQueryDto {
  @IsOptional()
  @IsEnum(QuestionnaireKind, {
    message: `kind debe ser uno de: ${Object.values(QuestionnaireKind).join(', ')}`,
  })
  kind?: QuestionnaireKind;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export class PeriodQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;
}

export class WeeksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'weeks debe ser un entero' })
  @Min(1, { message: 'weeks mínimo 1' })
  @Max(52, { message: 'weeks máximo 52' })
  weeks?: number;
}

export class WeeksPeriodQueryDto extends WeeksQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'periodId debe ser un UUID válido' })
  periodId?: string;
}
