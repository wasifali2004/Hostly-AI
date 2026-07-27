import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async uploadEventCover(userId: string, file: Express.Multer.File) {
    const canManage = await this.prisma.membership.findFirst({
      where: { userId, role: { in: [OrgRole.ORG_ADMIN, OrgRole.ORGANIZER] } },
      select: { id: true },
    });
    if (!canManage) {
      throw new ForbiddenException('Organizer access is required to upload event images');
    }

    const extension = this.extension(file);
    const filename = `${randomUUID()}${extension}`;
    const supabaseUrl = this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get('SUPABASE_STORAGE_BUCKET', 'event-images');

    if (supabaseUrl && serviceKey) {
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${filename}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': file.mimetype,
            'x-upsert': 'false',
          },
          body: new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }),
        },
      );
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Image storage rejected the upload (${response.status})`,
        );
      }
      return {
        url: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${filename}`,
        provider: 'supabase',
      };
    }

    const uploadDirectory = join(process.cwd(), 'uploads');
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(join(uploadDirectory, filename), file.buffer);
    const apiUrl = this.config.get('API_URL', 'http://localhost:4100').replace(/\/api\/v1\/?$/, '');
    return {
      url: `${apiUrl.replace(/\/$/, '')}/uploads/${filename}`,
      provider: 'local',
    };
  }

  private extension(file: Express.Multer.File) {
    const known: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return known[file.mimetype] ?? extname(file.originalname).toLowerCase();
  }
}
