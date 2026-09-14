import { authClient } from "#/lib/auth-client.ts";

export type CounterApiState = {
  count: number;
  updatedBy: string | null;
  receivedAt: string;
};

async function authorizationHeader() {
  const { data, error } = await authClient.token();

  if (error || !data?.token) {
    throw new Error(error?.message ?? "Unable to authenticate Counter request.");
  }

  return `Bearer ${data.token}`;
}

async function parseResponse(response: Response) {
  const result = (await response.json()) as CounterApiState & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? `Counter API request failed (${response.status}).`);
  }

  return result;
}

export async function getCounterState(
  organizationId: string,
  counterId: string,
) {
  const authorization = await authorizationHeader();
  const url = new URL("/api/counter/state", window.location.origin);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("counterId", counterId);

  const response = await fetch(url, {
    headers: {
      authorization,
    },
  });

  return parseResponse(response);
}

export async function sendCounterCommand(
  organizationId: string,
  counterId: string,
  action: "increment" | "decrement",
) {
  const authorization = await authorizationHeader();
  const response = await fetch("/api/counter/command", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      counterId,
      action,
    }),
  });

  return parseResponse(response);
}
