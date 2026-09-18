import { createFileRoute } from "@tanstack/react-router";

import { ensureCounterStatePushListener } from "#/lib/counter-mqtt.server.ts";

import {
  getAuthenticatedUserId,
  userCanAccessCounter,
} from "#/lib/push-auth.server.ts";
import {
  deleteFcmRegistration,
  upsertFcmRegistration,
} from "#/lib/push-store.server.ts";

type FcmRegistrationBody = {
  organizationId?: string;
  counterId?: string;
  token?: string;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/push/fcm")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        ensureCounterStatePushListener();
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Unauthorized", 401);

        let body: FcmRegistrationBody;
        try {
          body = (await request.json()) as FcmRegistrationBody;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const organizationId = body.organizationId?.trim();
        const counterId = body.counterId?.trim();
        const token = body.token?.trim();

        if (!organizationId || !counterId || !token) {
          return jsonError("organizationId, counterId, and token are required", 400);
        }

        if (!(await userCanAccessCounter(request, organizationId, counterId))) {
          return jsonError("Forbidden", 403);
        }

        upsertFcmRegistration({ token, userId, organizationId, counterId });
        return Response.json({ registered: true });
      },

      DELETE: async ({ request }: { request: Request }) => {
        const userId = await getAuthenticatedUserId(request);
        if (!userId) return jsonError("Unauthorized", 401);

        let body: Pick<FcmRegistrationBody, "token">;
        try {
          body = (await request.json()) as Pick<FcmRegistrationBody, "token">;
        } catch {
          return jsonError("Invalid JSON body", 400);
        }

        const token = body.token?.trim();
        if (!token) return jsonError("token is required", 400);

        deleteFcmRegistration(token, userId);
        return Response.json({ registered: false });
      },
    },
  },
});
