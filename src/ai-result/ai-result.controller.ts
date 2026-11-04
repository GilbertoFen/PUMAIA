import { Controller, Post, Get, UseGuards, BadRequestException } from '@nestjs/common';
import { AIResultService } from './ai-result.service';
import { JwtAuthGuard } from '../autenticacion/guards/jwt-auth.guard';
import { CurrentUser } from '../autenticacion/decorators/current-user.decorator';
import type { AuthUser } from '../autenticacion/interfaces/auth-user.interface';

@Controller('ai-analysis')
@UseGuards(JwtAuthGuard)
export class AIResultController {
  constructor(private readonly aiResultService: AIResultService) {}

  @Get('current')
  async getCurrentAnalysis(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    const results = await this.aiResultService.findByStudent(user.studentId);

    if (!results || results.length === 0) {
      return { hasAnalysis: false, data: null };
    }

    const latest = results[0];
    const options = latest.options || [];

    const opt1 = options.find((o) => o.position === 1);
    const opt2 = options.find((o) => o.position === 2);
    const opt3 = options.find((o) => o.position === 3);
    const opt4 = options.find((o) => o.position === 4);
    const opt5 = options.find((o) => o.position === 5);

    const parts = (opt1?.description || '').split('||');

    const formattedDate = new Date(latest.createdAt).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      hasAnalysis: true,
      data: {
        // Compatibilidad con frontend existente
        optionA: opt1?.title || '',
        descriptionA: parts[0] || '',
        meta_summary: parts[1] || '',
        meta_strengths: parts[2] || '',
        meta_opportunities: parts[3] || '',
        optionB: opt2?.title || '',
        descriptionB: opt2?.description || '',
        optionC: opt3?.title || '',
        descriptionC: opt3?.description || '',
        optionD: opt4?.title || '',
        descriptionD: opt4?.description || '',
        optionE: opt5?.title || '',
        descriptionE: opt5?.description || '',
        // Formato estructurado normalizado (esquema v3)
        options: options.map((opt) => ({
          id: opt.id,
          position: opt.position,
          title: opt.title,
          description: opt.description,
        })),
        createdAt: formattedDate,
      },
    };
  }

  @Post('generate')
  async generateAnalysis(@CurrentUser() user: AuthUser) {
    if (!user || !user.studentId) {
      throw new BadRequestException('El usuario no cuenta con un perfil de estudiante vinculado.');
    }

    const aiData = await this.aiResultService.processAndSaveAnalysis(user.studentId);

    const formattedDate = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      hasAnalysis: true,
      data: {
        ...aiData,
        createdAt: formattedDate,
      },
    };
  }
}
