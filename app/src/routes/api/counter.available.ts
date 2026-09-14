import { createFileRoute } from "@tanstack/react-router";

import {
  getAuthenticatedUserId,
  getAvailableCounters,
  hasCounterScope,
} from "#/lib/push-auth.server.ts";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/counter/available")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        if (!(await hasCounterScope(request, "counter:read"))) {
          return jsonError("Insufficient scope", 403);
        }

        try {
          const counters = await getAvailableCounters(request);

          if (!counters) {
            return jsonError("Unable to load Counter access", 502);
          }

          return Response.json({ counters });
        } catch (error: unknown) {
          return jsonError(
            error instanceof Error
              ? error.message
              : "Unable to load available Counters",
            502,
          );
        }
      },
    },
  },
});
