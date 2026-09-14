import { createFileRoute } from "@tanstack/react-router";

import {
  getAuthenticatedUserId,
  userCanAccessCounter,
} from "#/lib/push-auth.server.ts";
import {
  deletePushSubscription,
  upsertPushSubscription,
} from "#/lib/push-store.server.ts";

type PushSubscriptionBody = {
  organizationId?: string;
  counterId?: string;
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
};

type DeletePushSubscriptionBody = {
  endpoint?: string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        let body: PushSubscriptionBody;

        try {
          body = (await request.json()) as PushSubscriptionBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const organizationId = body.organizationId?.trim();
        const counterId = body.counterId?.trim();
        const endpoint = body.subscription?.endpoint?.trim();
        const p256dh = body.subscription?.keys?.p256dh?.trim();
        const auth = body.subscription?.keys?.auth?.trim();

        if (!organizationId || !counterId || !endpoint || !p256dh || !auth) {
          return jsonError("Incomplete push subscription", 400);
        }

        const allowed = await userCanAccessCounter(
          request,
          organizationId,
          counterId,
        );

        if (!allowed) {
          return jsonError("Forbidden", 403);
        }

        upsertPushSubscription({
          endpoint,
          userId,
          organizationId,
          counterId,
          p256dh,
          auth,
        });

        return Response.json({ subscribed: true });
      },

      DELETE: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);

        if (!userId) {
          return jsonError("Unauthorized", 401);
        }

        let body: DeletePushSubscriptionBody;

        try {
          body = (await request.json()) as DeletePushSubscriptionBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const endpoint = body.endpoint?.trim();

        if (!endpoint) {
          return jsonError("Push endpoint is required", 400);
        }

        deletePushSubscription(endpoint, userId);
        return Response.json({ subscribed: false });
      },
    },
  },
});
