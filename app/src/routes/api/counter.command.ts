import { createFileRoute } from "@tanstack/react-router";

import {
  getAuthenticatedUserId,
  hasCounterScope,
  userCanAccessCounter,
} from "#/lib/push-auth.server.ts";
import {
  ensureCounterStatePushListener,
  sendCounterCommand,
  type CounterCommand,
} from "#/lib/counter-mqtt.server.ts";

type CounterCommandBody = {
  organizationId?: string;
  counterId?: string;
  action?: CounterCommand;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/counter/command")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        ensureCounterStatePushListener();
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        if (!(await hasCounterScope(request, "counter:write"))) {
          return jsonError("Insufficient scope", 403);
        }

        let body: CounterCommandBody;

        try {
          body = (await request.json()) as CounterCommandBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const organizationId = body.organizationId?.trim();
        const counterId = body.counterId?.trim();
        const action = body.action;

        if (!organizationId || !counterId) {
          return jsonError("organizationId and counterId are required", 400);
        }

        if (
          action !== "increment" &&
          action !== "decrement" &&
          action !== "reset"
        ) {
          return jsonError("action must be increment, decrement, or reset", 400);
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
          const state = await sendCounterCommand(counterId, action, userId);

          return Response.json({
            organizationId,
            counterId,
            action,
            ...state,
          });
        } catch (error: unknown) {
          return jsonError(
            error instanceof Error ? error.message : "Unable to update Counter",
            502,
          );
        }
      },
    },
  },
});
