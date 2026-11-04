import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

export function resolveDatabaseConnectionString(): string {
  if (process.env.PUMAIA_DB_TARGET === 'local_test') {
    return (
      process.env.TEST_DIRECT_URL ||
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:postgres@127.0.0.1:5433/pumaia_test?schema=public'
    );
  }
  return process.env.DIRECT_URL || process.env.DATABASE_URL || '';
}

export function describeDatabaseTarget(rawUrl?: string): {
  host: string;
  port: string;
  database: string;
  schema: string;
  target: 'SUPABASE_REMOTE' | 'LOCAL_TEST' | 'UNKNOWN';
  connectionType: string;
} {
  try {
    const url = new URL(rawUrl || resolveDatabaseConnectionString());
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.replace(/^\//, '') || 'postgres';
    const schema = url.searchParams.get('schema') || 'public';
    const isSupabase =
      host.includes('supabase.co') || host.includes('pooler.supabase.com');
    const isLocal = host === '127.0.0.1' || host === 'localhost';
    const connectionType = host.includes('pooler.supabase.com')
      ? port === '6543'
        ? 'Supavisor Transaction Pooler'
        : 'Supavisor Session Pooler'
      : host.includes('supabase.co')
        ? 'Supabase Direct Connection'
        : 'Local PostgreSQL';

    return {
      host,
      port,
      database,
      schema,
      target: isSupabase ? 'SUPABASE_REMOTE' : isLocal ? 'LOCAL_TEST' : 'UNKNOWN',
      connectionType,
    };
  } catch {
    return {
      host: 'unknown',
      port: 'unknown',
      database: 'unknown',
      schema: 'public',
      target: 'UNKNOWN',
      connectionType: 'unknown',
    };
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public readonly connectionInfo = describeDatabaseTarget();

  constructor() {
    const connectionString = resolveDatabaseConnectionString();
    super({
      adapter: new PrismaPg({
        connectionString,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      `Conectado a PostgreSQL [${this.connectionInfo.target}] -> host=${this.connectionInfo.host}, port=${this.connectionInfo.port}, db=${this.connectionInfo.database}, schema=${this.connectionInfo.schema} (${this.connectionInfo.connectionType})`,
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
