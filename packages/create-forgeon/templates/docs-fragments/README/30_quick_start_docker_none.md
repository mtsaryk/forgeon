## Quick Start (Docker)

```bash
docker compose --env-file infra/docker/.env.example -f infra/docker/compose.yml up --build
```

Open API at `http://localhost:3000/api/health`.

Frontend is not served by Docker in `proxy=none` mode. Use `pnpm dev` for web.
