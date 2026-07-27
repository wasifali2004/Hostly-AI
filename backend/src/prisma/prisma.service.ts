import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseTarget: string;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    this.databaseTarget = PrismaService.safeDatabaseTarget(databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      const prismaCode =
        typeof error === 'object' && error !== null && 'errorCode' in error
          ? String(error.errorCode)
          : undefined;
      const message = error instanceof Error ? error.message : String(error);

      if (
        prismaCode === 'P1001' ||
        message.includes("Can't reach database server")
      ) {
        this.logger.error(
          `PostgreSQL is unavailable at ${this.databaseTarget}. ` +
            'Confirm that the Supabase project is active and DATABASE_URL in backend/.env ' +
            'contains the pooled hosted connection string, then run `npm run setup`.',
        );
      }

      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private static safeDatabaseTarget(databaseUrl: string): string {
    try {
      const parsed = new URL(databaseUrl);
      const databaseName = parsed.pathname.replace(/^\//, '');
      const port = parsed.port ? `:${parsed.port}` : '';
      return `${parsed.hostname}${port}/${databaseName}`;
    } catch {
      return 'the configured DATABASE_URL';
    }
  }
}
