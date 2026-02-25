export interface ValidationErrorDetail {
  field?: string;
  message: string;
}

export type AppErrorDetails = ValidationErrorDetail[] | Record<string, unknown>;

export interface AppErrorPayload {
  code: string;
  message: string;
  status: number;
  details?: AppErrorDetails;
  requestId?: string;
  timestamp: string;
}

export interface AppErrorEnvelope {
  error: AppErrorPayload;
}
