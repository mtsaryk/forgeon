import { Injectable } from '@nestjs/common';
import type { CommunicationPayloadValue } from './communications.types';

@Injectable()
export class TemplateRendererService {
  render(template: string, values: Record<string, CommunicationPayloadValue> = {}): string {
    let output = template;

    for (const [rawKey, rawValue] of Object.entries(values)) {
      const replacement = this.stringifyValue(rawValue);
      const normalizedKeys = new Set([rawKey, rawKey.toUpperCase()]);

      for (const key of normalizedKeys) {
        output = output.split(`$${key}$`).join(replacement);
      }
    }

    return output;
  }

  private stringifyValue(value: CommunicationPayloadValue): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }
}
