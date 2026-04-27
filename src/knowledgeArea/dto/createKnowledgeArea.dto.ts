import { IsEnum, IsNotEmpty } from 'class-validator';
import { KnowledgeArea } from '../enum/knowledgeArea.enum';

export class CreateKnowledgeAreaDto{
    @IsEnum(KnowledgeArea)
    @IsNotEmpty()
    knowledgeArea: KnowledgeArea;
}