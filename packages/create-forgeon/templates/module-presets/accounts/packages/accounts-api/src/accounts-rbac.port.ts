export const ACCOUNTS_AUTHZ_CLAIMS_RESOLVER = 'FORGEON_ACCOUNTS_AUTHZ_CLAIMS_RESOLVER';

export interface AccountsAuthzClaimsResolver {
  resolveClaims(_userId: string): Promise<{
    roles?: string[];
    permissions?: string[];
  }>;
}

export class NoopAccountsAuthzClaimsResolver implements AccountsAuthzClaimsResolver {
  async resolveClaims(): Promise<{ roles?: string[]; permissions?: string[] }> {
    return {};
  }
}
