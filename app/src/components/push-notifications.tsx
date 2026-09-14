import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon } from "lucide-react";

import { Button } from "#/components/ui/button.tsx";

type PushNotificationsProps = {
  organizationId: string;
  counterId: string;
};

type PushConfig = {
  vapidPublicKey?: string | null;
};

type PushState =
  | "checking"
  | "unsupported"
  | "disabled"
  | "enabled"
  | "denied"
  | "busy"
  | "error";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);

  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  };
}

export function PushNotifications({
  organizationId,
  counterId,
}: PushNotificationsProps) {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setState("unsupported");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) {
          setState("denied");
        }
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!cancelled) {
        setState(subscription ? "enabled" : "disabled");
      }
    }

    void refresh().catch((error: unknown) => {
      if (!cancelled) {
        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to check notification status.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enableNotifications() {
    setState("busy");
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }

      const configResponse = await fetch("/api/push/config");
      const config = (await configResponse.json()) as PushConfig;

      if (!configResponse.ok || !config.vapidPublicKey) {
        throw new Error("Push notifications are not configured on the server yet.");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.vapidPublicKey),
        });
      }

      const response = await fetch("/api/push", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          counterId,
          subscription: subscriptionPayload(subscription),
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save push subscription.");
      }

      setState("enabled");
      setMessage("Notifications enabled for this Counter.");
    } catch (error: unknown) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to enable notifications.",
      );
    }
  }

  async function disableNotifications() {
    setState("busy");
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        await subscription.unsubscribe();
      }

      setState("disabled");
      setMessage("Notifications disabled.");
    } catch (error: unknown) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to disable notifications.",
      );
    }
  }

  if (state === "unsupported") {
    return (
      <div className="text-right text-zinc-500">
        Add Counter to the iPhone Home Screen to enable push notifications.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="text-right text-zinc-500">
        Notifications are blocked in iPhone settings.
      </div>
    );
  }

  const enabled = state === "enabled";
  const busy = state === "checking" || state === "busy";

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "outline" : "secondary"}
        disabled={busy}
        onClick={() => {
          if (enabled) {
            void disableNotifications();
          } else {
            void enableNotifications();
          }
        }}
      >
        {enabled ? <BellOffIcon /> : <BellIcon />}
        {busy
          ? "Checking…"
          : enabled
            ? "Disable notifications"
            : "Enable notifications"}
      </Button>
      {message ? (
        <div className="max-w-64 text-right text-[11px] text-zinc-500">
          {message}
        </div>
      ) : null}
    </div>
  );
}
