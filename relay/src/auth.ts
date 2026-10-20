export function extractBearerSecret(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function extractWsSecret(request: Request, url: URL): string | null {
  const querySecret = url.searchParams.get("secret");
  if (querySecret) return querySecret;

  const proto = request.headers.get("Sec-WebSocket-Protocol");
  if (!proto) return null;
  const parts = proto.split(",").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("cc-secret.")) {
      return part.slice("cc-secret.".length);
    }
  }
  return null;
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
