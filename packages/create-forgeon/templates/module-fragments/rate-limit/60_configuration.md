## Configuration

Environment keys:

- `THROTTLE_ENABLED=true`
- `THROTTLE_TTL=10`
- `THROTTLE_LIMIT=3`
- `THROTTLE_TRUST_PROXY=false`

Meaning:

- `THROTTLE_ENABLED`: hard on/off switch
- `THROTTLE_TTL`: throttle window in seconds
- `THROTTLE_LIMIT`: maximum requests allowed inside that window
- `THROTTLE_TRUST_PROXY`: use forwarded client IPs when behind Caddy / Nginx
