### Proxy Preset: none

- No reverse proxy container is started.
- API is exposed directly on `http://localhost:3000`.
- Useful for minimal local backend testing.
- For OAuth/SSL-style local tests, prefer `proxy=caddy`.
