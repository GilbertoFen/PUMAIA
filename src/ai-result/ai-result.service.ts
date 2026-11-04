import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AICategoryService } from '../ai-category/ai-category.service';
import { StudentsService } from '../students/students.service';
import { CreateAIResultDto } from './dto/create-ai-result.dto';

@Injectable()
export class AIResultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCategoryService: AICategoryService,
    private readonly studentsService: StudentsService,
  ) {}

  async create(dto: CreateAIResultDto) {
    return await this.prisma.aIResult.create({
      data: {
        studentId: dto.studentId,
        categoryId: dto.categoryId,
        modelVersion: dto.modelVersion ?? null,
        options: {
          createMany: {
            data: dto.options.map((opt) => ({
              position: opt.position,
              title: opt.title,
              description: opt.description,
            })),
          },
        },
      },
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async findByStudent(studentId: string) {
    return await this.prisma.aIResult.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
        category: true,
      },
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
      body: JSON.stringify({ student_context: studentContext }),
    });

    if (!response.ok) {
      throw new Error('PumaIA (FastAPI) no pudo procesar el análisis.');
    }

    const aiData = await response.json();

    // 4. Validar categorías de IA desde el catálogo
    const aiCategories = await this.aiCategoryService.findAll();
    let defaultCategoryId: string;

    if (aiCategories.length === 0) {
      // Si no existe ninguna categoría de IA, crear una por defecto
      const newCat = await this.prisma.aICategory.create({
        data: { name: 'Rutas Profesionales' },
      });
      defaultCategoryId = newCat.id;
    } else {
      defaultCategoryId = aiCategories[0].id;
    }

    // 5. Preparar opciones dinámicas para AIResultOption SIN inventar opciones dummy
    const structuredOptions: { position: number; title: string; description: string }[] = [];

    const serializedDescriptionA = `${aiData.descriptionA || ''}||${aiData.meta_summary || ''}||${aiData.meta_strengths || ''}||${aiData.meta_opportunities || ''}`;

    if (Array.isArray(aiData.options) && aiData.options.length > 0) {
      // Si la IA responde con un arreglo estructurado de opciones
      const validOptions = aiData.options
        .filter((o: any) => o && (o.title || o.option))
        .slice(0, 5);

      validOptions.forEach((opt: any, index: number) => {
        const desc = index === 0 ? (opt.description || serializedDescriptionA) : (opt.description || '');
        structuredOptions.push({
          position: index + 1,
          title: String(opt.title || opt.option).trim(),
          description: desc,
        });
      });
    } else {
      // Si la IA responde con las claves tradicionales (optionA, optionB, ...)
      const candidates = [
        { title: aiData.optionA, description: serializedDescriptionA },
        { title: aiData.optionB, description: aiData.descriptionB || '' },
        { title: aiData.optionC, description: aiData.descriptionC || '' },
        { title: aiData.optionD, description: aiData.descriptionD || '' },
        { title: aiData.optionE, description: aiData.descriptionE || '' },
      ];

      candidates.forEach((cand) => {
        if (cand.title && typeof cand.title === 'string' && cand.title.trim().length > 0) {
          structuredOptions.push({
            position: structuredOptions.length + 1,
            title: cand.title.trim(),
            description: cand.description || '',
          });
        }
      });
    }

    if (structuredOptions.length === 0) {
      throw new BadRequestException('El motor de IA no generó recomendaciones vocacionales válidas.');
    }

    // 6. Persistencia relacional atómica (esquema v3: AIResult + AIResultOption)
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.aIResult.findFirst({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      });

      let targetResultId: string;

      if (existing) {
        targetResultId = existing.id;
        await tx.aIResult.update({
          where: { id: targetResultId },
          data: {
            categoryId: defaultCategoryId,
            createdAt: new Date(),
          },
        });
        await tx.aIResultOption.deleteMany({
          where: { resultId: targetResultId },
        });
      } else {
        const created = await tx.aIResult.create({
          data: {
            studentId,
            categoryId: defaultCategoryId,
          },
        });
        targetResultId = created.id;
      }

      await tx.aIResultOption.createMany({
        data: structuredOptions.map((opt) => ({
          resultId: targetResultId,
          position: opt.position,
          title: opt.title,
          description: opt.description,
        })),
      });
    });

    return aiData;
  }
}
