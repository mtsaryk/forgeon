FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile=false

COPY apps/web apps/web
WORKDIR /app/apps/web
RUN pnpm build

CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]
