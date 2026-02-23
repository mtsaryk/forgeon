FROM node:20-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY packages/core/package.json packages/core/package.json
COPY packages/i18n/package.json packages/i18n/package.json

RUN pnpm install --frozen-lockfile=false

COPY apps/api apps/api
COPY packages/core packages/core
COPY packages/i18n packages/i18n
COPY resources resources

RUN pnpm --filter @forgeon/i18n build
RUN pnpm --filter @forgeon/api prisma:generate
RUN pnpm --filter @forgeon/api build

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @forgeon/api prisma:migrate:deploy && node apps/api/dist/main.js"]
