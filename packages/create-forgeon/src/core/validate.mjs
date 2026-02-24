import { ensureDatabaseSupported } from '../databases/index.mjs';
import { ensureFrontendSupported } from '../frameworks/index.mjs';
import { ensureProxySupported } from '../infrastructure/proxy.mjs';

export function validatePresetSupport({ frontend, db, dockerEnabled, proxy }) {
  ensureFrontendSupported(frontend);
  ensureDatabaseSupported(db);

  if (dockerEnabled) {
    ensureProxySupported(proxy);
  }
}
