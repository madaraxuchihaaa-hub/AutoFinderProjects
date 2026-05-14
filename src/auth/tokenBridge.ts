let accessTokenGetter: (() => Promise<string | null>) | null = null;

export function registerAccessTokenGetter(fn: () => Promise<string | null>): void {
  accessTokenGetter = fn;
}

export async function getStoredAccessToken(): Promise<string | null> {
  if (!accessTokenGetter) return null;
  return accessTokenGetter();
}
