import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import {
  deleteFcmRegistration,
  listFcmRegistrationsForCounter,
} from "#/lib/push-store.server.ts";

function messaging() {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: "niteowl-capacity-counter",
    });
  return getMessaging(app);
}

export async function sendFcmStateToCounter(
  organizationId: string,
  counterId: string,
  count: number,
) {
  const registrations = listFcmRegistrationsForCounter(
    organizationId,
    counterId,
  );

  if (registrations.length === 0) {
    return { registrations: 0, sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    registrations.map(async (registration) => {
      try {
        await messaging().send({
          token: registration.token,
          data: {
            organizationId,
            counterId,
            count: String(count),
          },
          android: {
            priority: "high",
          },
        });
      } catch (error: unknown) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";

        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          deleteFcmRegistration(registration.token, registration.userId);
        }
        throw error;
      }
    }),
  );

  return {
    registrations: registrations.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
