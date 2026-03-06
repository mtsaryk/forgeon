import type { FilesAccessSubject } from './files-access.types';

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  user?: {
    sub?: string;
    id?: string;
  };
  headers?: Record<string, HeaderValue>;
};

function getHeaderValue(headers: Record<string, HeaderValue> | undefined, key: string): string | null {
  if (!headers) {
    return null;
  }
  const value = headers[key];
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  return value;
}

export function extractFilesAccessSubject(request: RequestLike): FilesAccessSubject {
  const actorId =
    request.user?.sub ??
    request.user?.id ??
    getHeaderValue(request.headers, 'x-forgeon-user-id') ??
    null;

  const permissionsRaw = getHeaderValue(request.headers, 'x-forgeon-permissions');
  const permissions =
    permissionsRaw
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  return {
    actorId,
    permissions,
  };
}
