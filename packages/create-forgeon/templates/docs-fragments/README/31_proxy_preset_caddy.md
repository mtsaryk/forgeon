### Proxy Preset: Caddy

- `/api/*` is proxied to `api:3000`.
- Static frontend build is served by Caddy.
- Main proxy config: `infra/caddy/Caddyfile`.
- Compose service wiring: `infra/docker/compose.yml` (`caddy` service).
- Safe to edit: host ports and env values in `infra/docker/.env.example`.
- Avoid renaming service hosts (`api`, `db`) unless you also update proxy/compose config.
- Recommended preset for local SSL/OAuth-style testing.
