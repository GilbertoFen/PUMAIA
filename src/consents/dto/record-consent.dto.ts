import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConsentKind } from '@prisma/client';

export class RecordConsentDto {
  @IsEnum(ConsentKind, { message: 'El tipo de consentimiento debe ser TERMS_AND_NOTICE, ANALYTICS o IMPROVEMENT' })
  kind: ConsentKind;

  @IsString()
  @IsNotEmpty({ message: 'El id del aviso de privacidad es obligatorio' })
  noticeId: string;

  @IsBoolean({ message: 'granted debe ser un valor booleano' })
  granted: boolean;
}

export class BatchConsentDto {
  @IsArray({ message: 'consents debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => RecordConsentDto)
  @IsNotEmpty({ message: 'Se requiere una lista de consentimientos' })
  consents: RecordConsentDto[];
}

