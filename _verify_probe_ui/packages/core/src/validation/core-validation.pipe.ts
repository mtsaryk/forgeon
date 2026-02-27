import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationErrorDetail } from '../errors';

type ValidationNode = {
  property?: string;
  constraints?: Record<string, string>;
  children?: ValidationNode[];
};

function toPath(parentPath: string, property: string | undefined): string {
  if (!property || property.length === 0) {
    return parentPath;
  }
  return parentPath.length > 0 ? `${parentPath}.${property}` : property;
}

function collectValidationDetails(
  errors: ValidationNode[],
  parentPath = '',
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const error of errors) {
    const field = toPath(parentPath, error.property);
    const constraints = error.constraints ? Object.values(error.constraints) : [];

    for (const message of constraints) {
      details.push(field.length > 0 ? { field, message } : { message });
    }

    if (Array.isArray(error.children) && error.children.length > 0) {
      details.push(...collectValidationDetails(error.children, field));
    }
  }

  return details;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    validationError: {
      target: false,
      value: false,
    },
    exceptionFactory: (errors) => {
      const details = collectValidationDetails(errors as ValidationNode[]);
      const firstMessage = details[0]?.message ?? 'Validation failed';
      return new BadRequestException({
        message: firstMessage,
        details,
      });
    },
  });
}
