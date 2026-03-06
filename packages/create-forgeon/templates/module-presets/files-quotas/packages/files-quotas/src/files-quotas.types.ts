export type FilesQuotaCheckInput = {
  ownerType: string;
  ownerId: string | null;
  fileSize: number;
};

export type FilesQuotaCheckResult = {
  allowed: boolean;
  reason: 'ok' | 'disabled' | 'owner-missing' | 'max-files' | 'max-bytes';
  limits: {
    maxFilesPerOwner: number;
    maxBytesPerOwner: number;
  };
  current: {
    filesCount: number;
    totalBytes: number;
  };
  next: {
    filesCount: number;
    totalBytes: number;
  };
};
