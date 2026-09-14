type CounterAccessResponse = {
  allowed?: boolean;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
};

type JwksResponse = {
  keys?: JsonWebKey[];
};

function getAuthBaseUrl(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();

  if (
    hostname === "mccarthysirishpub.com" ||
    hostname.endsWith(".mccarthysirishpub.com")
  ) {
    return "https://console.mccarthysirishpub.com";
  }

  if (hostname === "niteowl.dev" || hostname.endsWith(".niteowl.dev")) {
    return "https://console.niteowl.dev";
  }

  const configured = process.env.AUTH_BASE_URL ?? process.env.VITE_AUTH_BASE_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "https://console.niteowl.dev";
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token.length > 0 ? token : null;
}

function decodeBase64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function audienceIncludes(audience: string | string[] | undefined, expected: string) {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected;
}

async function verifyJwt(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  let header: JwtHeader;
  let payload: JwtPayload;

  try {
    header = decodeBase64UrlJson<JwtHeader>(parts[0]);
    payload = decodeBase64UrlJson<JwtPayload>(parts[1]);
  } catch {
    return null;
  }

  if (header.alg !== "EdDSA" || !header.kid) {
    return null;
  }

  const authBaseUrl = getAuthBaseUrl(request);

  if (
    payload.iss !== authBaseUrl ||
    !audienceIncludes(payload.aud, authBaseUrl) ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    (typeof payload.exp === "number" && payload.exp <= now) ||
    (typeof payload.nbf === "number" && payload.nbf > now)
  ) {
    return null;
  }

  const jwksResponse = await fetch(`${authBaseUrl}/api/auth/jwks`);

  if (!jwksResponse.ok) {
    return null;
  }

  const jwks = (await jwksResponse.json()) as JwksResponse;
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);

  if (!jwk) {
    return null;
  }

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      Buffer.from(parts[2], "base64url"),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );

    return verified ? payload : null;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUserId(request: Request) {
  const payload = await verifyJwt(request);
  return payload?.sub ?? null;
}

export async function userCanAccessCounter(
  request: Request,
  organizationId: string,
  counterId: string,
) {
  const userId = await getAuthenticatedUserId(request);

  if (!userId) {
    return false;
  }

  const internalSecret = process.env.COUNTER_AUTH_INTERNAL_SECRET?.trim();

  if (!internalSecret) {
    throw new Error("COUNTER_AUTH_INTERNAL_SECRET is not configured.");
  }

  const url = new URL(`${getAuthBaseUrl(request)}/api/auth/counter/access/internal`);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("counterId", counterId);
  url.searchParams.set("userId", userId);

  const response = await fetch(url, {
    headers: {
      "x-counter-internal-secret": internalSecret,
    },
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as CounterAccessResponse;
  return result.allowed === true;
}
