import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AICategoryService } from '../ai-category/ai-category.service';
import { StudentsService } from '../students/students.service';

@Injectable()
export class AIResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCategoryService: AICategoryService,
    private readonly studentsService: StudentsService,
  ) { }
  async create(dto: any) {
    return await this.prisma.aIResult.create({ data: dto });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.aIResult.findMany({
      where: { studentId },
      orderBy: { id: 'desc' },
    });
  }

  async processAndSaveAnalysis(studentId: string): Promise<any> {
    // 1. Obtener expediente relacional del alumno
    const student = await this.studentsService.getFullProfileSummary(studentId);
    if (!student) throw new BadRequestException('Estudiante no encontrado.');

    // Función auxiliar para aplanar respuestas del cuestionario
    const parseAnswerText = (ans: any): string => {
      if (!ans) return 'Sin responder';
      if (typeof ans === 'string') return ans;
      if (Array.isArray(ans)) return ans.join(', ');
      if (typeof ans === 'object') return `${ans.answer || ''} ${ans.exp ? `(${ans.exp})` : ''}`;
      return String(ans);
    };

    const studentContext = `
      Nombre: ${student.name} ${student.lastNameP}
      Semestre: ${student.currentSemester} | Promedio: ${student.average}
      Intereses: ${student.interest || 'No declarados'}
      Cursos: ${student.courses?.map((c: any) => c.course?.name).filter(Boolean).join(', ') || 'Ninguno'}
      Concursos: ${student.contests?.map((cn: any) => cn.contest?.name).filter(Boolean).join(', ') || 'Ninguno'}
      Becas: ${student.schoolarships?.map((s: any) => s.schoolarship?.name).filter(Boolean).join(', ') || 'Ninguna'}
      Experiencia laboral: ${student.experiences?.map((e: any) => e.areaExpertise?.name).filter(Boolean).join(', ') || 'Ninguna'}
      Idiomas: ${student.languages?.map((l: any) => l.language?.name).filter(Boolean).join(', ') || 'Ninguno'}
      ${student.answers?.map((a: any, index: number) => `Pregunta ${index + 1} [ID: ${a.questionId}]: ${parseAnswerText(a.answer)}`).join('\n  ') || 'No ha respondido el cuestionario base.'}
    `;

    // 3. Petición a FastAPI
    const fastApiUrl = process.env.FASTAPI_URL || 'https://server-genai.onrender.com/analyze-profile';
    const response = await fetch(fastApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_context: studentContext })
    });

    if (!response.ok) {
      throw new Error('PumaIA (FastAPI) no pudo procesar el análisis.');
    }

    const aiData = await response.json();

    // 4. Validar categorías de IA desde el catálogo
    const aiCategories = await this.aiCategoryService.findAll();
    if (aiCategories.length === 0) {
      throw new BadRequestException('Falta inicializar las categorías de IA en el Seed.');
    }
    const defaultCategoryId = aiCategories[0].id;

    // 5. Serializar metadatos para descriptionA
    const serializedDescriptionA = `${aiData.descriptionA}||${aiData.meta_summary}||${aiData.meta_strengths}||${aiData.meta_opportunities}`;

    const payloadResult = {
      studentId: studentId,
      categoryId: defaultCategoryId,
      optionA: aiData.optionA,
      descriptionA: serializedDescriptionA,
      optionB: aiData.optionB,
      descriptionB: aiData.descriptionB,
      optionC: aiData.optionC,
      descriptionC: aiData.descriptionC,
      optionD: aiData.optionD,
      descriptionD: aiData.descriptionD,
      optionE: aiData.optionE,
      descriptionE: aiData.descriptionE,
    };

    // 6. Control de registro único (Upsert condicional)
    const existingResults = await this.findByStudent(studentId);
    if (existingResults && existingResults.length > 0) {
      const latestAnalysisId = existingResults[0].id;
      await this.prisma.aIResult.update({
        where: { id: latestAnalysisId },
        data: payloadResult
      });
    } else {
      await this.create(payloadResult);
    }

    return aiData;
  }
}