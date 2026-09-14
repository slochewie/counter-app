type SessionResponse = {
  user?: {
    id?: string;
  };
};

type CounterAccessResponse = {
  allowed?: boolean;
};

function getAuthBaseUrl(request: Request) {
  const configured =
    process.env.AUTH_BASE_URL ??
    process.env.VITE_AUTH_BASE_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const hostname = new URL(request.url).hostname.toLowerCase();

  if (
    hostname === "mccarthysirishpub.com" ||
    hostname.endsWith(".mccarthysirishpub.com")
  ) {
    return "https://console.mccarthysirishpub.com";
  }

  return "https://console.niteowl.dev";
}

function forwardedAuthHeaders(request: Request) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return headers;
}

export async function getAuthenticatedUserId(request: Request) {
  const response = await fetch(`${getAuthBaseUrl(request)}/api/auth/get-session`, {
    headers: forwardedAuthHeaders(request),
  });

  if (!response.ok) {
    return null;
  }

  const result = (await response.json()) as SessionResponse | null;
  const userId = result?.user?.id;

  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

export async function userCanAccessCounter(
  request: Request,
  organizationId: string,
  counterId: string,
) {
  const url = new URL(`${getAuthBaseUrl(request)}/api/auth/counter/access`);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("counterId", counterId);

  const response = await fetch(url, {
    headers: forwardedAuthHeaders(request),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as CounterAccessResponse;
  return result.allowed === true;
}
