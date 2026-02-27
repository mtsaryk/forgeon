FROM node:20-alpine AS web-builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY tsconfig.base.node.json ./
COPY tsconfig.base.esm.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile=false

COPY apps/web apps/web
WORKDIR /app/apps/web
RUN pnpm build

FROM caddy:2-alpine
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-builder /app/apps/web/dist /srv
