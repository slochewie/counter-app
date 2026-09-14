import webpush from "web-push";

import {
  deletePushSubscription,
  listPushSubscriptionsForCounter,
} from "#/lib/push-store.server.ts";

type PushNotification = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Counter Web Push VAPID configuration is incomplete.");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushToCounter(
  organizationId: string,
  counterId: string,
  notification: PushNotification,
) {
  configureWebPush();

  const subscriptions = listPushSubscriptionsForCounter(
    organizationId,
    counterId,
  );

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url ?? "/",
    tag: notification.tag ?? `counter-${counterId}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );

        return { endpoint: subscription.endpoint, sent: true };
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          deletePushSubscription(subscription.endpoint, subscription.userId);
        }

        throw error;
      }
    }),
  );

  return {
    subscriptions: subscriptions.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
