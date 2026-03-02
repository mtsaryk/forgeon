## How It Works

Implementation details:

- `RateLimitConfigService` reads `THROTTLE_*` env values through `@nestjs/config`.
- `ForgeonRateLimitModule` registers `ThrottlerModule` globally.
- A global guard applies the throttle rules to incoming HTTP requests.
- When `THROTTLE_TRUST_PROXY=true`, the module enables Express `trust proxy` through the active HTTP adapter so client IPs are resolved correctly behind reverse proxies.

Error behavior:

- throttled requests return HTTP `429`
- the existing Forgeon error envelope wraps the response as `TOO_MANY_REQUESTS`
