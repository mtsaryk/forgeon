import { DynamicModule, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { join } from 'path';

export interface ForgeonI18nOptions {
  enabled: boolean;
  defaultLang: string;
  fallbackLang: string;
  path?: string;
}

@Module({})
export class ForgeonI18nModule {
  static register(options: ForgeonI18nOptions): DynamicModule {
    if (!options.enabled) {
      return { module: ForgeonI18nModule };
    }

    const translationsPath =
      options.path ?? join(process.cwd(), 'resources', 'i18n');

    return {
      module: ForgeonI18nModule,
      imports: [
        I18nModule.forRoot({
          fallbackLanguage: options.fallbackLang,
          loader: I18nJsonLoader,
          loaderOptions: {
            path: translationsPath,
            watch: false,
          },
          resolvers: [
            { use: AcceptLanguageResolver, options: { matchType: 'strict-loose' } },
            { use: QueryResolver, options: ['lang'] },
          ],
        }),
      ],
      exports: [I18nModule],
    };
  }
}

