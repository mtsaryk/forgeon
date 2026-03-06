export type StoredFileInput = {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  ownerType?: string;
  ownerId?: string;
  visibility?: string;
  createdById?: string;
  auditContext?: {
    requestId?: string | null;
    ip?: string | null;
    userId?: string | null;
  };
};

export type FileVariantKey = 'original' | 'preview';

export type FileRecordDto = {
  id: string;
  publicId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageDriver: string;
  ownerType: string;
  ownerId: string | null;
  visibility: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  availableVariants: FileVariantKey[];
};
