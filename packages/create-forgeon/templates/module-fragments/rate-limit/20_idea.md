## Idea / Why

This module adds a simple first-line request throttle to the API.

It exists to reduce three common classes of problems:

1. burst traffic from accidental frontend loops
2. low-cost abuse against public endpoints
3. brute-force style retries against auth endpoints

It is intentionally small and predictable. The goal is not to replace a WAF, CDN, or distributed rate limiter. The goal is to give every Forgeon project a safe baseline that can be installed in one step.
