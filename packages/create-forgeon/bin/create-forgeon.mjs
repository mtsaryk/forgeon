#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';

const IMPLEMENTED_FRONTENDS = ['react'];
const IMPLEMENTED_DBS = ['prisma'];
const SUPPORTED_PROXIES = ['nginx', 'caddy'];

function printHelp() {
  console.log(`create-forgeon

Usage:
  npx create-forgeon@latest <project-name> [options]

Options:
  --frontend <react|angular>   Frontend preset (implemented: react)
  --db <prisma>                DB preset (implemented: prisma)
  --i18n <true|false>          Enable i18n (default: true)
  --docker <true|false>        Include Docker/infra files (default: true)
  --proxy <nginx|caddy>        Reverse proxy preset when docker=true (default: nginx)
  --install                    Run pnpm install after generation
  -y, --yes                    Skip prompts and use defaults
  -h, --help                   Show this help
`);
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;

  throw new Error(`Invalid boolean value: ${value}`);
}

function toKebabCase(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'forgeon-app'
  );
}

function copyRecursive(source, destination) {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.copyFileSync(source, destination);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMarkdownSection(content, title) {
  const pattern = new RegExp(`\\n## ${escapeRegex(title)}[\\s\\S]*?(?=\\n## |$)`, 'm');
  return content.replace(pattern, '');
}

function removeIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function patchReadme(targetRoot, { dockerEnabled, i18nEnabled }) {
  const readmePath = path.join(targetRoot, 'README.md');
  if (!fs.existsSync(readmePath)) return;

  let content = fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');

  if (!dockerEnabled) {
    content = removeMarkdownSection(content, 'Quick Start (Docker)');
    content = removeMarkdownSection(content, 'Prisma In Docker Start');
    content = content.replace(
      /2\. Start local Postgres \(Docker\):[\s\S]*?```\n3\. Run API \+ web in dev mode:/m,
      '2. Ensure PostgreSQL is running locally and configure `DATABASE_URL` in `apps/api/.env`.\n3. Run API + web in dev mode:',
    );
    content = content.replace(
      /```bash\ndocker compose[\s\S]*?Open `http:\/\/localhost:8080`\.\n?/m,
      '',
    );
    content = content.replace(
      /API container starts with:[\s\S]*?This keeps container startup production-like while still simple\.\n?/m,
      '',
    );
  }

  if (!i18nEnabled) {
    content = removeMarkdownSection(content, 'i18n Toggle');
    content = content.replace(
      'optional i18n (enabled by default), and ',
      '',
    );
    content = content.replace(
      /Set in env:[\s\S]*?When `I18N_ENABLED=false`, API runs without loading i18n module\.\n?/m,
      '',
    );
  }

  content = content.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(readmePath, content.trimEnd() + '\n', 'utf8');
}

function patchAiDocs(targetRoot, { dockerEnabled, i18nEnabled }) {
  const projectDoc = path.join(targetRoot, 'docs', 'AI', 'PROJECT.md');
  if (fs.existsSync(projectDoc)) {
    let content = fs.readFileSync(projectDoc, 'utf8').replace(/\r\n/g, '\n');
    if (!i18nEnabled) {
      content = content
        .replace(/^\- `packages\/i18n`.*\r?\n/gm, '')
        .replace(/^\- `resources\/i18n`.*\r?\n/gm, '');
    }
    if (!dockerEnabled) {
      content = content.replace(
        /(^|\n)### Docker mode\n[\s\S]*?(?=\n### |\n## |$)/,
        '\n',
      );
      content = content.replace(/^\- `infra`.*\r?\n/gm, '');
    }
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(projectDoc, content.trimEnd() + '\n', 'utf8');
  }

  const archDoc = path.join(targetRoot, 'docs', 'AI', 'ARCHITECTURE.md');
  if (fs.existsSync(archDoc)) {
    let content = fs.readFileSync(archDoc, 'utf8').replace(/\r\n/g, '\n');
    if (!i18nEnabled) {
      content = content
        .replace(/^\- `I18N_ENABLED`.*\r?\n/gm, '')
        .replace(/^\- `I18N_DEFAULT_LANG`.*\r?\n/gm, '')
        .replace(/^\- `I18N_FALLBACK_LANG`.*\r?\n/gm, '')
        .replace(/^\- `resources\/\*`.*\r?\n/gm, '');
    }
    if (!dockerEnabled) {
      content = content.replace(/^\- `infra\/\*`.*\r?\n/gm, '');
      content = content.replace(
        /## Future DB Presets \(Not Implemented Yet\)[\s\S]*?(?=\n## |$)/,
        `## Future DB Presets (Not Implemented Yet)

A future preset can switch DB by:
1. Replacing \`PrismaModule\` with another DB module package (for example Mongo package).
2. Updating \`DATABASE_URL\` and related env keys.
3. Keeping app-level services dependent only on repository/data-access abstractions.
`,
      );
    }
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(archDoc, content.trimEnd() + '\n', 'utf8');
  }
}

function applyProxyPreset(targetRoot, proxy) {
  const dockerDir = path.join(targetRoot, 'infra', 'docker');
  const composeTarget = path.join(dockerDir, 'compose.yml');
  const composeSource = path.join(dockerDir, `compose.${proxy}.yml`);

  if (!fs.existsSync(composeSource)) {
    throw new Error(`Missing proxy compose preset: ${composeSource}`);
  }

  fs.copyFileSync(composeSource, composeTarget);

  removeIfExists(path.join(dockerDir, 'compose.nginx.yml'));
  removeIfExists(path.join(dockerDir, 'compose.caddy.yml'));

  if (proxy === 'nginx') {
    removeIfExists(path.join(dockerDir, 'caddy.Dockerfile'));
    removeIfExists(path.join(targetRoot, 'infra', 'caddy'));
  } else if (proxy === 'caddy') {
    removeIfExists(path.join(dockerDir, 'nginx.Dockerfile'));
    removeIfExists(path.join(targetRoot, 'infra', 'nginx'));
  }
}

function applyI18nDisabled(targetRoot) {
  removeIfExists(path.join(targetRoot, 'packages', 'i18n'));
  removeIfExists(path.join(targetRoot, 'resources', 'i18n'));

  const apiPackagePath = path.join(targetRoot, 'apps', 'api', 'package.json');
  if (fs.existsSync(apiPackagePath)) {
    const apiPackage = JSON.parse(fs.readFileSync(apiPackagePath, 'utf8'));

    if (apiPackage.scripts) {
      delete apiPackage.scripts.predev;
    }

    if (apiPackage.dependencies) {
      delete apiPackage.dependencies['@forgeon/i18n'];
      delete apiPackage.dependencies['nestjs-i18n'];
    }

    writeJson(apiPackagePath, apiPackage);
  }

  const apiDockerfile = path.join(targetRoot, 'apps', 'api', 'Dockerfile');
  if (fs.existsSync(apiDockerfile)) {
    let content = fs.readFileSync(apiDockerfile, 'utf8');
    content = content
      .replace(/^COPY packages\/i18n\/package\.json packages\/i18n\/package\.json\r?\n/gm, '')
      .replace(/^COPY packages\/i18n packages\/i18n\r?\n/gm, '')
      .replace(/^RUN pnpm --filter @forgeon\/i18n build\r?\n/gm, '');
    fs.writeFileSync(apiDockerfile, content, 'utf8');
  }

  const appModulePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  fs.writeFileSync(
    appModulePath,
    `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
  providers: [AppExceptionFilter],
})
export class AppModule {}
`,
    'utf8',
  );

  const healthControllerPath = path.join(
    targetRoot,
    'apps',
    'api',
    'src',
    'health',
    'health.controller.ts',
  );
  fs.writeFileSync(
    healthControllerPath,
    `import { Controller, Get, Query } from '@nestjs/common';
import { EchoQueryDto } from '../common/dto/echo-query.dto';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(@Query('lang') _lang?: string) {
    return {
      status: 'ok',
      message: 'OK',
    };
  }

  @Get('echo')
  getEcho(@Query() query: EchoQueryDto) {
    return { value: query.value };
  }
}
`,
    'utf8',
  );

  const filterPath = path.join(
    targetRoot,
    'apps',
    'api',
    'src',
    'common',
    'filters',
    'app-exception.filter.ts',
  );
  fs.writeFileSync(
    filterPath,
    `import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';

@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? Array.isArray((payload as { message?: unknown }).message)
          ? String((payload as { message: unknown[] }).message[0] ?? 'Internal server error')
          : String((payload as { message?: unknown }).message ?? 'Internal server error')
        : typeof payload === 'string'
          ? payload
          : 'Internal server error';

    response.status(status).json({
      error: {
        code: this.resolveCode(status),
        message,
      },
    });
  }

  private resolveCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'validation_error';
      case HttpStatus.UNAUTHORIZED:
        return 'unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'forbidden';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.CONFLICT:
        return 'conflict';
      default:
        return 'internal_error';
    }
  }
}
`,
    'utf8',
  );

  const appConfigPath = path.join(targetRoot, 'apps', 'api', 'src', 'config', 'app.config.ts');
  fs.writeFileSync(
    appConfigPath,
    `import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
}));
`,
    'utf8',
  );
}

function patchDockerEnvForI18n(targetRoot, i18nEnabled) {
  const dockerEnvPath = path.join(targetRoot, 'infra', 'docker', '.env.example');
  if (fs.existsSync(dockerEnvPath) && !i18nEnabled) {
    const content = fs
      .readFileSync(dockerEnvPath, 'utf8')
      .replace(/^I18N_ENABLED=.*\r?\n/gm, '')
      .replace(/^I18N_DEFAULT_LANG=.*\r?\n/gm, '')
      .replace(/^I18N_FALLBACK_LANG=.*\r?\n/gm, '');
    fs.writeFileSync(dockerEnvPath, content.trimEnd() + '\n', 'utf8');
  }

  const composePath = path.join(targetRoot, 'infra', 'docker', 'compose.yml');
  if (fs.existsSync(composePath) && !i18nEnabled) {
    const content = fs
      .readFileSync(composePath, 'utf8')
      .replace(/^\s+I18N_ENABLED:.*\r?\n/gm, '')
      .replace(/^\s+I18N_DEFAULT_LANG:.*\r?\n/gm, '')
      .replace(/^\s+I18N_FALLBACK_LANG:.*\r?\n/gm, '');
    fs.writeFileSync(composePath, content, 'utf8');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    name: undefined,
    frontend: undefined,
    db: undefined,
    i18n: undefined,
    docker: undefined,
    proxy: undefined,
    install: false,
    yes: false,
    help: false,
  };

  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') continue;

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '-y' || arg === '--yes') {
      options.yes = true;
      continue;
    }

    if (arg === '--install') {
      options.install = true;
      continue;
    }

    if (arg.startsWith('--no-')) {
      const key = arg.slice(5);
      if (key === 'install') options.install = false;
      if (key === 'docker') options.docker = false;
      if (key === 'i18n') options.i18n = false;
      continue;
    }

    if (arg.startsWith('--')) {
      const [keyRaw, inlineValue] = arg.split('=');
      const key = keyRaw.slice(2);

      let value = inlineValue;
      if (value === undefined && args[i + 1] && !args[i + 1].startsWith('-')) {
        value = args[i + 1];
        i += 1;
      }

      if (Object.prototype.hasOwnProperty.call(options, key)) {
        options[key] = value;
      }

      continue;
    }

    positional.push(arg);
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!options.name && positional.length > 0) {
    options.name = positional[0];
  }

  const rl = readline.createInterface({ input, output });

  if (!options.name) {
    options.name = await rl.question('Project name: ');
  }

  if (!options.yes && !options.frontend) {
    options.frontend =
      (await rl.question('Frontend (react/angular) [react]: ')) || 'react';
  }

  if (!options.yes && !options.db) {
    options.db = (await rl.question('DB preset [prisma]: ')) || 'prisma';
  }

  if (!options.yes && options.i18n === undefined) {
    options.i18n = (await rl.question('Enable i18n (true/false) [true]: ')) || 'true';
  }

  if (!options.yes && options.docker === undefined) {
    options.docker =
      (await rl.question('Include Docker/infra (true/false) [true]: ')) || 'true';
  }

  const dockerEnabledPre = parseBoolean(options.docker, true);
  if (dockerEnabledPre && !options.yes && !options.proxy) {
    options.proxy =
      (await rl.question('Reverse proxy preset (nginx/caddy) [nginx]: ')) || 'nginx';
  }

  await rl.close();

  if (!options.name || options.name.trim().length === 0) {
    console.error('Project name is required.');
    process.exit(1);
  }

  const frontend = (options.frontend ?? 'react').toString().toLowerCase();
  const db = (options.db ?? 'prisma').toString().toLowerCase();
  const i18nEnabled = parseBoolean(options.i18n, true);
  const dockerEnabled = parseBoolean(options.docker, true);
  const proxy = dockerEnabled
    ? (options.proxy ?? 'nginx').toString().toLowerCase()
    : 'none';

  if (!IMPLEMENTED_FRONTENDS.includes(frontend)) {
    if (frontend === 'angular') {
      throw new Error('Frontend preset "angular" is not implemented yet. Use --frontend react.');
    }
    throw new Error(`Unsupported frontend preset: ${frontend}`);
  }

  if (!IMPLEMENTED_DBS.includes(db)) {
    throw new Error(`Unsupported db preset: ${db}. Currently implemented: prisma.`);
  }

  if (dockerEnabled && !SUPPORTED_PROXIES.includes(proxy)) {
    throw new Error(`Unsupported proxy preset: ${proxy}. Use nginx or caddy.`);
  }

  const projectName = options.name.trim();
  const targetRoot = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetRoot)) {
    console.error(`Target directory already exists: ${targetRoot}`);
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templateRoot = path.resolve(scriptDir, '..', 'templates', 'base');

  copyRecursive(templateRoot, targetRoot);

  const rootPackageJsonPath = path.join(targetRoot, 'package.json');
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
  rootPackageJson.name = toKebabCase(projectName);

  if (rootPackageJson.scripts) {
    delete rootPackageJson.scripts['create:forgeon'];

    if (!dockerEnabled) {
      delete rootPackageJson.scripts['docker:up'];
      delete rootPackageJson.scripts['docker:down'];
    }
  }

  writeJson(rootPackageJsonPath, rootPackageJson);

  if (!dockerEnabled) {
    removeIfExists(path.join(targetRoot, 'infra'));
    removeIfExists(path.join(targetRoot, 'apps', 'api', 'Dockerfile'));
    removeIfExists(path.join(targetRoot, 'apps', 'web', 'Dockerfile'));
  } else {
    applyProxyPreset(targetRoot, proxy);
    patchDockerEnvForI18n(targetRoot, i18nEnabled);
  }

  if (!i18nEnabled) {
    applyI18nDisabled(targetRoot);
  }

  const apiEnvExamplePath = path.join(targetRoot, 'apps', 'api', '.env.example');
  const apiEnvLines = [
    'PORT=3000',
    'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public',
  ];

  if (i18nEnabled) {
    apiEnvLines.push('I18N_ENABLED=true');
    apiEnvLines.push('I18N_DEFAULT_LANG=en');
    apiEnvLines.push('I18N_FALLBACK_LANG=en');
  }

  fs.writeFileSync(apiEnvExamplePath, `${apiEnvLines.join('\n')}\n`, 'utf8');

  patchReadme(targetRoot, { dockerEnabled, i18nEnabled });
  patchAiDocs(targetRoot, { dockerEnabled, i18nEnabled });

  if (parseBoolean(options.install, false)) {
    const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const result = spawnSync(pnpmCmd, ['install'], {
      cwd: targetRoot,
      stdio: 'inherit',
      shell: false,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  console.log('Forgeon scaffold generated.');
  console.log(`- path: ${targetRoot}`);
  console.log(`- frontend: ${frontend}`);
  console.log(`- db: ${db}`);
  console.log(`- i18n: ${i18nEnabled}`);
  console.log(`- docker: ${dockerEnabled}`);
  console.log(`- proxy: ${proxy}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
