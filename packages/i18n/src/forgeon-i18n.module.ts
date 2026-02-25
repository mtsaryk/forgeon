import { DynamicModule, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  I18nJsonLoader,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { join } from 'path';
import { I18nConfigModule } from './i18n-config.module';
import { I18nConfigService } from './i18n-config.service';

export interface ForgeonI18nOptions {
  path?: string;
}

@Module({})
export class ForgeonI18nModule {
  static register(options: ForgeonI18nOptions = {}): DynamicModule {
    const translationsPath = options.path ?? join(process.cwd(), 'resources', 'i18n');
    const resolvers = [
      { use: AcceptLanguageResolver, options: { matchType: 'strict-loose' } },
      { use: QueryResolver, options: ['lang'] },
    ];

    return {
      module: ForgeonI18nModule,
      imports: [
        I18nConfigModule,
        I18nModule.forRootAsync({
          imports: [I18nConfigModule],
          inject: [I18nConfigService],
          resolvers,
          useFactory: (config: I18nConfigService) => ({
            fallbackLanguage: config.fallbackLang,
            loader: I18nJsonLoader,
            loaderOptions: {
              path: translationsPath,
              watch: false,
            },
          }),
        }),
      ],
      exports: [I18nModule, I18nConfigModule],
    };
  }
}

