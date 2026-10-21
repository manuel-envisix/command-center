export function extractBearerSecret(request: { headers: { authorization?: string | string[] } }): string | null {
  const raw = request.headers.authorization;
  const auth = Array.isArray(raw) ? raw[0] : raw;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function isAuthorized(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
