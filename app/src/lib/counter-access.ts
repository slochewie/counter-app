import { authBaseURL } from "#/lib/auth-client.ts";

export type EligibleOrganizationMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export type CounterAssignment = {
  userId: string;
  counterIds: string[];
};

type EligibleMembersResponse = {
  members?: EligibleOrganizationMember[];
  error?: string;
};

type CounterAssignmentsResponse = {
  assignments?: CounterAssignment[];
  error?: string;
};

type CounterAssignmentUpdateResponse = {
  assignment?: {
    userId: string;
    counterId: string;
    enabled: boolean;
  };
  error?: string;
};

type CounterAccessResponse = {
  allowed?: boolean;
  error?: string;
};

export async function listEligibleOrganizationMembers(organizationId: string) {
  const url = new URL(
    "/api/auth/organization-member-status/eligible",
    authBaseURL,
  );
  url.searchParams.set("organizationId", organizationId);

  const response = await fetch(url, {
    credentials: "include",
  });

  const result = (await response.json()) as EligibleMembersResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to load active organization members.",
    );
  }

  return Array.isArray(result.members) ? result.members : [];
}

export async function listCounterAssignments(organizationId: string) {
  const url = new URL("/api/auth/counter/assignments", authBaseURL);
  url.searchParams.set("organizationId", organizationId);

  const response = await fetch(url, {
    credentials: "include",
  });

  if (response.status === 404) {
    return {
      assignments: [] as CounterAssignment[],
      available: false,
    };
  }

  const result = (await response.json()) as CounterAssignmentsResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to load Counter assignments.",
    );
  }

  return {
    assignments: Array.isArray(result.assignments) ? result.assignments : [],
    available: true,
  };
}

export async function updateCounterAssignment(
  organizationId: string,
  userId: string,
  counterId: string,
  enabled: boolean,
) {
  const url = new URL("/api/auth/counter/assignments", authBaseURL);

  const response = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      userId,
      counterId,
      enabled,
    }),
  });

  const result = (await response.json()) as CounterAssignmentUpdateResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to update Counter assignment.",
    );
  }

  if (!result.assignment) {
    throw new Error("Counter assignment update completed without an assignment.");
  }

  return result.assignment;
}

export async function getCounterAccess(
  organizationId: string,
  counterId: string,
  signal?: AbortSignal,
) {
  const url = new URL("/api/auth/counter/access", authBaseURL);
  url.searchParams.set("organizationId", organizationId);
  url.searchParams.set("counterId", counterId);

  const response = await fetch(url, {
    credentials: "include",
    signal,
  });

  const result = (await response.json()) as CounterAccessResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to verify Counter access.",
    );
  }

  return result.allowed === true;
}
