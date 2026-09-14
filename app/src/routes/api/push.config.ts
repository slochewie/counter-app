import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/push/config")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
        });
      },
    },
  },
});
