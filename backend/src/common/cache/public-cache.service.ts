import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import IORedis from 'ioredis';

/**
 * Optional read-through cache for public resources.
 *
 * Hosted deployments prefer Upstash's HTTPS REST API, which works without a
 * persistent TCP connection. REDIS_URL remains supported for providers that
 * expose the native Redis protocol. When neither transport is configured (or
 * the provider is temporarily unavailable), every method falls back to the
 * supplied database loader.
 */
@Injectable()
export class PublicCacheService implements OnModuleInit, OnModuleDestroy {
  private client?: IORedis;
  private readonly redisUrl?: string;
  private readonly upstashRestUrl?: string;
  private readonly upstashRestToken?: string;
  private readonly keyPrefix: string;

  constructor(config: ConfigService) {
    this.redisUrl = config.get<string>('REDIS_URL') || undefined;
    this.upstashRestUrl = config
      .get<string>('UPSTASH_REDIS_REST_URL')
      ?.replace(/\/$/, '');
    this.upstashRestToken =
      config.get<string>('UPSTASH_REDIS_REST_TOKEN') || undefined;
    const explicitNamespace = config.get<string>('CACHE_NAMESPACE')?.trim();
    const databaseIdentity = config.get<string>('DATABASE_URL') || 'database';
    const namespace =
      explicitNamespace ||
      createHash('sha256').update(databaseIdentity).digest('hex').slice(0, 12);
    this.keyPrefix = `hostly:${namespace}:public:`;
  }

  async onModuleInit() {
    if (this.hasUpstashRest()) return;
    if (!this.redisUrl) return;
    const client = new IORedis(this.redisUrl, {
      keyPrefix: this.keyPrefix,
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3_000,
      retryStrategy: () => null,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      this.client = client;
    } catch {
      await client.quit().catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
    this.client = undefined;
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (this.hasUpstashRest()) {
      try {
        const cached = await this.restCommand<string | null>('GET', this.key(key));
        if (cached) return JSON.parse(cached) as T;
      } catch {
        // The database remains the source of truth when the cache is unavailable.
      }
      const value = await loader();
      await this.restCommand(
        'SET',
        this.key(key),
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      ).catch(() => undefined);
      return value;
    }

    if (!this.client) return loader();
    try {
      const cached = await this.client.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // Continue through the database loader and best-effort cache write below.
    }
    const value = await loader();
    await this.client
      .set(key, JSON.stringify(value), 'EX', ttlSeconds)
      .catch(() => undefined);
    return value;
  }

  async version(namespace: string): Promise<string> {
    if (this.hasUpstashRest()) {
      return (
        (await this.restCommand<string | null>(
          'GET',
          this.key(`version:${namespace}`),
        ).catch(() => null)) ?? '0'
      );
    }
    if (!this.client) return 'database';
    return (await this.client.get(`version:${namespace}`).catch(() => null)) ?? '0';
  }

  async invalidate(namespace: string, ...keys: string[]) {
    if (this.hasUpstashRest()) {
      await Promise.allSettled([
        this.restCommand('INCR', this.key(`version:${namespace}`)),
        ...(keys.length
          ? [this.restCommand('DEL', ...keys.map((key) => this.key(key)))]
          : []),
      ]);
      return;
    }
    if (!this.client) return;
    await Promise.allSettled([
      this.client.incr(`version:${namespace}`),
      ...(keys.length ? [this.client.del(...keys)] : []),
    ]);
  }

  private hasUpstashRest(): boolean {
    return Boolean(this.upstashRestUrl && this.upstashRestToken);
  }

  private key(value: string): string {
    return `${this.keyPrefix}${value}`;
  }

  private async restCommand<T = unknown>(
    command: string,
    ...arguments_: Array<string | number>
  ): Promise<T> {
    if (!this.upstashRestUrl || !this.upstashRestToken) {
      throw new Error('Upstash REST is not configured');
    }

    const response = await fetch(this.upstashRestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.upstashRestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...arguments_]),
      signal: AbortSignal.timeout(3_000),
    });
    const payload = (await response.json()) as {
      result?: T;
      error?: string;
    };
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Upstash returned HTTP ${response.status}`);
    }
    return payload.result as T;
  }
}
