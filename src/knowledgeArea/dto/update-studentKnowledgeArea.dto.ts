import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { KnowledgeArea } from '../enum/knowledgeArea.enum';

export class UpdateKnowledgeAreaDto{
    @IsEnum(KnowledgeArea)
    @IsNotEmpty()
    @IsOptional()
    knowledgeArea?: KnowledgeArea;
}