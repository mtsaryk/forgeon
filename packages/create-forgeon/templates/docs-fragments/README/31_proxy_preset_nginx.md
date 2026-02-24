### Proxy Preset: Nginx

- `/api/*` is proxied to `api:3000`.
- Static frontend build is served by Nginx.
- Main proxy config: `infra/nginx/nginx.conf`.
- Compose service wiring: `infra/docker/compose.yml` (`nginx` service).
- Safe to edit: host ports and env values in `infra/docker/.env.example`.
- Avoid renaming service hosts (`api`, `db`) unless you also update proxy/compose config.
