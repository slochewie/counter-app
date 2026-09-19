import { authBaseURL } from "#/lib/auth-client.ts";

export type EligibleOrganizationMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

export type CounterDefinition = {
  id: string;
  name: string;
  enabled: boolean;
};

export type CounterAssignment = {
  userId: string;
  counterIds: string[];
};

export type CounterManagementAccess = {
  allowed: boolean;
  canManageManagers: boolean;
};

type EligibleMembersResponse = {
  members?: EligibleOrganizationMember[];
  error?: string;
};

type CounterDefinitionsResponse = {
  counters?: CounterDefinition[];
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

type CounterManagementAccessResponse = {
  allowed?: boolean;
  canManageManagers?: boolean;
  error?: string;
};

type CounterManagersResponse = {
  managerUserIds?: string[];
  globalAdminUserIds?: string[];
  canManageManagers?: boolean;
  error?: string;
};

type CounterManagerUpdateResponse = {
  manager?: {
    userId: string;
    enabled: boolean;
  };
  error?: string;
};

function authEndpoint(path: string) {
  return `${authBaseURL.replace(/\/$/, "")}${path}`;
}

function authEndpointWithOrganization(path: string, organizationId: string) {
  return `${authEndpoint(path)}?organizationId=${encodeURIComponent(organizationId)}`;
}

export async function listEligibleOrganizationMembers(organizationId: string) {
  const response = await fetch(
    authEndpointWithOrganization(
      "/api/auth/organization-member-status/eligible",
      organizationId,
    ),
    {
      credentials: "include",
    },
  );

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

export async function listCounters(organizationId: string) {
  const response = await fetch(
    authEndpointWithOrganization("/api/auth/counter/list", organizationId),
    {
      credentials: "include",
    },
  );

  const result = (await response.json()) as CounterDefinitionsResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to load Counters.",
    );
  }

  return Array.isArray(result.counters) ? result.counters : [];
}

export async function createCounter(
  organizationId: string,
  name: string,
) {
  const response = await fetch(authEndpoint("/api/auth/counter/create"), {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ organizationId, name }),
  });

  const result = (await response.json()) as {
    counter?: CounterDefinition;
    error?: string;
  };

  if (!response.ok || !result.counter) {
    throw new Error(
      typeof result.error === "string" ? result.error : "Unable to create Counter.",
    );
  }

  return result.counter;
}

export async function updateCounter(
  organizationId: string,
  counterId: string,
  changes: { name?: string; enabled?: boolean },
) {
  const response = await fetch(authEndpoint("/api/auth/counter/update"), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ organizationId, counterId, ...changes }),
  });

  const result = (await response.json()) as {
    counter?: CounterDefinition;
    error?: string;
  };

  if (!response.ok || !result.counter) {
    throw new Error(
      typeof result.error === "string" ? result.error : "Unable to update Counter.",
    );
  }

  return result.counter;
}

export async function deleteCounter(
  organizationId: string,
  counterId: string,
) {
  const response = await fetch(authEndpoint("/api/auth/counter/delete"), {
    method: "DELETE",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ organizationId, counterId }),
  });

  const result = (await response.json()) as {
    deleted?: boolean;
    error?: string;
  };

  if (!response.ok || result.deleted !== true) {
    throw new Error(
      typeof result.error === "string" ? result.error : "Unable to delete Counter.",
    );
  }
}


export async function listCounterAssignments(organizationId: string) {
  const response = await fetch(
    authEndpointWithOrganization("/api/auth/counter/assignments", organizationId),
    {
      credentials: "include",
    },
  );

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
  const response = await fetch(authEndpoint("/api/auth/counter/assignments"), {
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

export async function getCounterManagementAccess(
  organizationId: string,
  signal?: AbortSignal,
): Promise<CounterManagementAccess> {
  const response = await fetch(
    authEndpointWithOrganization(
      "/api/auth/counter/management-access",
      organizationId,
    ),
    {
      credentials: "include",
      signal,
    },
  );

  const result = (await response.json()) as CounterManagementAccessResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to verify Counter management access.",
    );
  }

  return {
    allowed: result.allowed === true,
    canManageManagers: result.canManageManagers === true,
  };
}

export async function listCounterManagers(organizationId: string) {
  const response = await fetch(
    authEndpointWithOrganization("/api/auth/counter/manager-list", organizationId),
    {
      credentials: "include",
    },
  );

  const result = (await response.json()) as CounterManagersResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to load Counter managers.",
    );
  }

  return {
    managerUserIds: Array.isArray(result.managerUserIds)
      ? result.managerUserIds
      : [],
    globalAdminUserIds: Array.isArray(result.globalAdminUserIds)
      ? result.globalAdminUserIds
      : [],
    canManageManagers: result.canManageManagers === true,
  };
}

export async function updateCounterManager(
  organizationId: string,
  userId: string,
  enabled: boolean,
) {
  const response = await fetch(authEndpoint("/api/auth/counter/manager"), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      userId,
      enabled,
    }),
  });

  const result = (await response.json()) as CounterManagerUpdateResponse;

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Unable to update Counter manager.",
    );
  }

  if (!result.manager) {
    throw new Error("Counter manager update completed without a manager.");
  }

  return result.manager;
}

export async function getCounterAccess(
  organizationId: string,
  counterId: string,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${authEndpointWithOrganization(
      "/api/auth/counter/access",
      organizationId,
    )}&counterId=${encodeURIComponent(counterId)}`,
    {
      credentials: "include",
      signal,
    },
  );

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
