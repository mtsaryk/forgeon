FROM node:20-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json tsconfig.base.node.json tsconfig.base.esm.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY packages/core/package.json packages/core/package.json
COPY packages/db-prisma/package.json packages/db-prisma/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/auth-contracts/package.json packages/auth-contracts/package.json
COPY packages/auth-api/package.json packages/auth-api/package.json

RUN pnpm install --frozen-lockfile=false

COPY apps/api apps/api
COPY packages/core packages/core
COPY packages/db-prisma packages/db-prisma
COPY packages/logger packages/logger
COPY packages/auth-contracts packages/auth-contracts
COPY packages/auth-api packages/auth-api
COPY resources resources

RUN pnpm --filter @forgeon/core build
RUN pnpm --filter @forgeon/db-prisma build
RUN pnpm --filter @forgeon/auth-contracts build
RUN pnpm --filter @forgeon/auth-api build
RUN pnpm --filter @forgeon/logger build
RUN pnpm --filter @forgeon/api prisma:generate
RUN pnpm --filter @forgeon/api build

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @forgeon/api prisma:migrate:deploy && node apps/api/dist/main.js"]
