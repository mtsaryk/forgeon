const SUPPORTED_PROXIES = ['caddy', 'nginx', 'none'];

export function ensureProxySupported(proxy) {
  if (!SUPPORTED_PROXIES.includes(proxy)) {
    throw new Error(`Unsupported proxy preset: ${proxy}. Use caddy, nginx, or none.`);
  }
}

export function getProxyConfigPath(proxy) {
  if (proxy === 'none') return 'n/a';
  return proxy === 'caddy' ? 'infra/caddy/Caddyfile' : 'infra/nginx/nginx.conf';
}
