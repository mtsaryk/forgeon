export type SanitizeImageInput = {
  buffer: Buffer;
  declaredMimeType: string;
  originalName: string;
  auditContext?: {
    requestId?: string | null;
    ip?: string | null;
    userId?: string | null;
  };
};

export type SanitizeImageResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  transformed: boolean;
  detectedMimeType: string | null;
};
