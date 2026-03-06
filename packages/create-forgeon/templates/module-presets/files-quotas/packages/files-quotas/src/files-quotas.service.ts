import { ConflictException, Injectable } from '@nestjs/common';
import { FilesService } from '@forgeon/files';
import { FilesQuotasConfigService } from './files-quotas-config.service';
import type { FilesQuotaCheckInput, FilesQuotaCheckResult } from './files-quotas.types';

@Injectable()
export class FilesQuotasService {
  constructor(
    private readonly filesService: FilesService,
    private readonly configService: FilesQuotasConfigService,
  ) {}

  get enabled(): boolean {
    return this.configService.enabled;
  }

  get limits() {
    return {
      maxFilesPerOwner: this.configService.maxFilesPerOwner,
      maxBytesPerOwner: this.configService.maxBytesPerOwner,
    };
  }

  async evaluateUpload(input: FilesQuotaCheckInput): Promise<FilesQuotaCheckResult> {
    const limits = this.limits;
    const emptyUsage = {
      filesCount: 0,
      totalBytes: 0,
    };
    const baseResult = {
      limits,
      current: emptyUsage,
      next: {
        filesCount: emptyUsage.filesCount + 1,
        totalBytes: emptyUsage.totalBytes + input.fileSize,
      },
    };

    if (!this.enabled) {
      return {
        allowed: true,
        reason: 'disabled',
        ...baseResult,
      };
    }

    if (!input.ownerId) {
      return {
        allowed: true,
        reason: 'owner-missing',
        ...baseResult,
      };
    }

    const usage = await this.filesService.getOwnerUsage(input.ownerType, input.ownerId);
    const next = {
      filesCount: usage.filesCount + 1,
      totalBytes: usage.totalBytes + input.fileSize,
    };

    if (next.filesCount > limits.maxFilesPerOwner) {
      return {
        allowed: false,
        reason: 'max-files',
        limits,
        current: usage,
        next,
      };
    }
    if (next.totalBytes > limits.maxBytesPerOwner) {
      return {
        allowed: false,
        reason: 'max-bytes',
        limits,
        current: usage,
        next,
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      limits,
      current: usage,
      next,
    };
  }

  async assertUploadAllowed(input: FilesQuotaCheckInput): Promise<void> {
    const result = await this.evaluateUpload(input);
    if (result.allowed) {
      return;
    }

    throw new ConflictException({
      message: 'File quota exceeded for owner',
      details: {
        reason: result.reason,
        limits: result.limits,
        current: result.current,
        next: result.next,
      },
    });
  }

  async getProbeStatus(input: FilesQuotaCheckInput): Promise<{
    status: 'ok';
    feature: 'files-quotas';
    result: FilesQuotaCheckResult;
  }> {
    const result = await this.evaluateUpload(input);
    return {
      status: 'ok',
      feature: 'files-quotas',
      result,
    };
  }
}
