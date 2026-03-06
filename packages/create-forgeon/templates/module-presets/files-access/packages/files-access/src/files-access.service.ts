import { ForbiddenException, Injectable } from '@nestjs/common';
import type { FilesAccessRecord, FilesAccessSubject } from './files-access.types';

@Injectable()
export class FilesAccessService {
  can(action: 'read' | 'delete', record: FilesAccessRecord, subject: FilesAccessSubject): boolean {
    if (subject.permissions.includes('files.manage')) {
      return true;
    }

    const isOwner =
      subject.actorId !== null &&
      record.ownerType === 'user' &&
      record.ownerId !== null &&
      record.ownerId === subject.actorId;

    if (isOwner) {
      return true;
    }

    if (action === 'read' && record.visibility === 'public') {
      return true;
    }

    return false;
  }

  canRead(record: FilesAccessRecord, subject: FilesAccessSubject): boolean {
    return this.can('read', record, subject);
  }

  canDelete(record: FilesAccessRecord, subject: FilesAccessSubject): boolean {
    return this.can('delete', record, subject);
  }

  assertCanRead(record: FilesAccessRecord, subject: FilesAccessSubject): void {
    if (!this.canRead(record, subject)) {
      throw new ForbiddenException({
        message: 'You do not have permission to read this file.',
        details: {
          required: 'owner or files.manage or public visibility',
          action: 'read',
        },
      });
    }
  }

  assertCanDelete(record: FilesAccessRecord, subject: FilesAccessSubject): void {
    if (!this.canDelete(record, subject)) {
      throw new ForbiddenException({
        message: 'You do not have permission to delete this file.',
        details: {
          required: 'owner or files.manage',
          action: 'delete',
        },
      });
    }
  }
}
