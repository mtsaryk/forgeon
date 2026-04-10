import * as fs from 'node:fs';
import * as path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { CommunicationChannel } from './communications.types';
import { CommunicationsConfigService } from './communications-config.service';

type TemplateVariant = 'body' | 'subject';

const CHANNEL_EXTENSIONS: Record<CommunicationChannel, string> = {
  email: '.html',
  sms: '.txt',
  push: '.json',
};

const SUBJECT_EXTENSION = '.subject.txt';
const TEMPLATE_ERROR_CODES = {
  invalidKey: 'COMMUNICATIONS_TEMPLATE_INVALID_KEY',
  missing: 'COMMUNICATIONS_TEMPLATE_MISSING',
} as const;

@Injectable()
export class TemplateLoaderService {
  constructor(private readonly configService: CommunicationsConfigService) {}

  async loadChannelTemplate(
    channel: CommunicationChannel,
    kind: string,
    locale?: string,
  ): Promise<string> {
    const relativePath = this.resolveTemplateRelativePath(channel, kind, 'body', locale);
    return this.readTemplate(relativePath, channel, kind);
  }

  async loadOptionalEmailSubjectTemplate(kind: string, locale?: string): Promise<string | null> {
    const relativePath = this.resolveTemplateRelativePath('email', kind, 'subject', locale);
    const absolutePath = path.join(this.configService.templatesRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    return fsPromises.readFile(absolutePath, 'utf8');
  }

  private resolveTemplateRelativePath(
    channel: CommunicationChannel,
    kind: string,
    variant: TemplateVariant,
    locale?: string,
  ): string {
    const safeKind = this.sanitizeSegment(kind, 'kind');
    const safeLocale = locale ? this.sanitizeSegment(locale, 'locale') : null;
    const extension = variant === 'subject' ? SUBJECT_EXTENSION : CHANNEL_EXTENSIONS[channel];

    if (safeLocale) {
      const localizedPath = path.join(channel, `${safeKind}.${safeLocale}${extension}`);
      const absoluteLocalizedPath = path.join(this.configService.templatesRoot, localizedPath);
      if (fs.existsSync(absoluteLocalizedPath)) {
        return localizedPath;
      }
    }

    return path.join(channel, `${safeKind}${extension}`);
  }

  private async readTemplate(relativePath: string, channel: CommunicationChannel, kind: string): Promise<string> {
    const absolutePath = path.join(this.configService.templatesRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new InternalServerErrorException({
        message: 'Communication template was not found',
        details: {
          code: TEMPLATE_ERROR_CODES.missing,
          channel,
          kind,
          relativePath,
        },
      });
    }

    return fsPromises.readFile(absolutePath, 'utf8');
  }

  private sanitizeSegment(value: string, field: 'kind' | 'locale'): string {
    const normalized = value.trim();
    if (!/^[a-z0-9._-]+$/i.test(normalized)) {
      throw new BadRequestException({
        message: `Communication ${field} contains unsupported characters`,
        details: {
          code: TEMPLATE_ERROR_CODES.invalidKey,
          field,
          value,
        },
      });
    }

    return normalized;
  }
}
