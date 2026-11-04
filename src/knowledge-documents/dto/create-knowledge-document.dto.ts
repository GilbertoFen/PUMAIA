import { IsUUID, IsNotEmpty, IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateKnowledgeDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  institutionId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  version: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}

