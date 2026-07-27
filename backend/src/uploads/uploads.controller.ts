import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('event-cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        callback(
          allowed.includes(file.mimetype)
            ? null
            : new BadRequestException('Only JPG, PNG, WebP, and GIF images are supported'),
          allowed.includes(file.mimetype),
        );
      },
    }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('An image file is required');
    return this.uploads.uploadEventCover(user.id, file);
  }
}
