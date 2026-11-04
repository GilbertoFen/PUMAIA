import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Ejecuta diagnóstico de salud integral del backend PumaIA.
   */
  async checkHealth() {
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;

    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch (error) {
      dbStatus = 'UNHEALTHY';
      this.logger.error('Error al verificar conexión con PostgreSQL:', error?.message);
    }

    const fastapiChatUrl = this.config.get<string>('FASTAPI_CHAT_URL') || 'http://127.0.0.1:8000/api/chat';
    const hasGoogleClientId = !!this.config.get<string>('GOOGLE_CLIENT_ID');
    const hasJwtSecret = !!this.config.get<string>('JWT_SECRET');

    return {
      status: dbStatus === 'HEALTHY' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: '1.0.0',
      database: {
        status: dbStatus,
        provider:
          this.prisma.connectionInfo?.target === 'SUPABASE_REMOTE'
            ? 'PostgreSQL (Supabase)'
            : 'PostgreSQL (Local Test)',
        target: this.prisma.connectionInfo?.target || 'UNKNOWN',
        host: this.prisma.connectionInfo?.host || 'unknown',
        port: this.prisma.connectionInfo?.port || 'unknown',
        databaseName: this.prisma.connectionInfo?.database || 'unknown',
        schema: this.prisma.connectionInfo?.schema || 'public',
        connectionType: this.prisma.connectionInfo?.connectionType || 'unknown',
        latencyMs: dbLatencyMs,
      },
      aiProvider: {
        configuredUrl: fastapiChatUrl,
        mode: 'FastAPI / n8n Gateway',
      },
      security: {
        googleAuthEnabled: hasGoogleClientId,
        jwtConfigured: hasJwtSecret,
        rbacActive: true,
        consentsEnforced: true,
      },
    };
  }
}

