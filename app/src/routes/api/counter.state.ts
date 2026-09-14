import { createFileRoute } from "@tanstack/react-router";

import { getAuthenticatedUserId, userCanAccessCounter } from "#/lib/push-auth.server.ts";
import { getCounterState } from "#/lib/counter-mqtt.server.ts";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/counter/state")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        const url = new URL(request.url);
        const organizationId = url.searchParams.get("organizationId")?.trim();
        const counterId = url.searchParams.get("counterId")?.trim();

        if (!organizationId || !counterId) {
          return jsonError("organizationId and counterId are required", 400);
        }

        const allowed = await userCanAccessCounter(
          request,
          organizationId,
          counterId,
        );

        if (!allowed) {
          return jsonError("Forbidden", 403);
        }

        try {
          const state = await getCounterState(counterId);

          return Response.json({
            organizationId,
            counterId,
            ...state,
          });
        } catch (error: unknown) {
          return jsonError(
            error instanceof Error ? error.message : "Unable to read Counter state",
            502,
          );
        }
      },
    },
  },
});
