## Docker Runtime Flow

- Compose file: `infra/docker/compose.yml`
- API starts through migration deploy, then NestJS server boot.
- Active reverse proxy preset: `{{PROXY_LABEL}}` (`{{PROXY_CONFIG_PATH}}`)
