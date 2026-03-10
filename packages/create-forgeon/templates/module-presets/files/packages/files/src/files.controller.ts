import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from 'node:stream';
import { CreateFileDto } from './dto/create-file.dto';
import { FilesService } from './files.service';
import type { FileVariantKey } from './files.types';

type UploadedFileShape = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body() body: CreateFileDto,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('File is required. Use multipart/form-data with field "file".');
    }

    return this.filesService.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      visibility: body.visibility,
      createdById: body.createdById,
    });
  }

  @Get(':publicId')
  async getMetadata(@Param('publicId') publicId: string) {
    return this.filesService.getByPublicId(publicId);
  }

  @Get(':publicId/download')
  async download(@Param('publicId') publicId: string, @Query('variant') variantQuery?: string) {
    const variant = this.parseVariant(variantQuery);
    const payload = await this.filesService.openDownload(publicId, variant);
    return new StreamableFile(payload.stream as Readable, {
      disposition: `inline; filename="${payload.fileName}"`,
      type: payload.mimeType,
    });
  }

  @Delete(':publicId')
  async remove(@Param('publicId') publicId: string) {
    return this.filesService.deleteByPublicId(publicId);
  }

  private parseVariant(variantQuery?: string): FileVariantKey {
    if (!variantQuery || variantQuery.length === 0) {
      return 'original';
    }

    if (variantQuery === 'original' || variantQuery === 'preview') {
      return variantQuery;
    }

    throw new BadRequestException({
      message: 'Unsupported file variant',
      details: {
        variant: variantQuery,
        allowedVariants: ['original', 'preview'],
      },
    });
  }
}
