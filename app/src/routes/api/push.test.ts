import { createFileRoute } from "@tanstack/react-router";

import {
  getAuthenticatedUserId,
  userCanAccessCounter,
} from "#/lib/push-auth.server.ts";
import { sendPushToCounter } from "#/lib/push-send.server.ts";

type PushTestBody = {
  organizationId?: string;
  counterId?: string;
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

        let body: PushTestBody;

        try {
          body = (await request.json()) as PushTestBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const organizationId = body.organizationId?.trim();
        const counterId = body.counterId?.trim();

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
          const result = await sendPushToCounter(organizationId, counterId, {
            title: "Counter notifications are working",
            body: "This is a test notification from NiteOwl.dev Counter.",
            url: "/",
            tag: `counter-test-${counterId}`,
          });

          return Response.json(result);
        } catch (error: unknown) {
          return jsonError(
            error instanceof Error ? error.message : "Unable to send test push",
            500,
          );
        }
      },
    },
  },
});
