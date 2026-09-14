import { createFileRoute } from "@tanstack/react-router";

import {
  getAuthenticatedUserId,
  userCanAccessCounter,
} from "#/lib/push-auth.server.ts";
import { sendPushToCounter } from "#/lib/push-send.server.ts";

type PushCountBody = {
  organizationId?: string;
  organizationName?: string;
  counterId?: string;
  count?: number;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/push/test")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        let body: PushCountBody;

        try {
          body = (await request.json()) as PushCountBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const organizationId = body.organizationId?.trim();
        const organizationName = body.organizationName?.trim();
        const counterId = body.counterId?.trim();
        const count = body.count;

        if (!organizationId || !organizationName || !counterId) {
          return jsonError(
            "organizationId, organizationName, and counterId are required",
            400,
          );
        }

        if (typeof count !== "number" || !Number.isInteger(count)) {
          return jsonError("count must be an integer", 400);
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
          const result = await sendPushToCounter(organizationId, counterId, {
            title: organizationName,
            body: `Current count: ${count}`,
            url: "/",
            tag: `counter-count-${counterId}`,
          });

          return Response.json(result);
        } catch (error: unknown) {
          return jsonError(
            error instanceof Error ? error.message : "Unable to send current count",
            500,
          );
        }
      },
    },
  },
});
