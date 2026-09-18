import mqtt from "mqtt";
import { sendFcmStateToCounter } from "../lib/fcm-send.server.ts";
import { listOrganizationIdsForCounter } from "../lib/push-store.server.ts";

const host =
  process.env.MQTT_HOST ??
  process.env.VITE_MQTT_HOST ??
  "wss://mqtt.niteowl.dev";
const username = process.env.MQTT_USERNAME ?? process.env.VITE_MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD ?? process.env.VITE_MQTT_PASSWORD;

if (!username || !password) {
  throw new Error("Counter MQTT credentials are not configured.");
}

const lastCounts = new Map<string, number>();

const client = mqtt.connect(host, {
  username,
  password,
  reconnectPeriod: 0,
  clean: true,
  clientId: "counter_push_fcm_bridge",
});

client.on("connect", () => {
  console.log("Counter FCM bridge connected");
  client.subscribe("counters/+/capacity/state", (error) => {
    if (error) {
      console.error("Counter FCM bridge subscribe failed", error);
      return;
    }
    console.log("Counter FCM bridge subscribed");
  });
});

client.on("message", (topic, message) => {
  const match = /^counters\/([A-Za-z0-9_-]+)\/capacity\/state$/.exec(topic);
  if (!match) return;

  let data: unknown;
  try {
    data = JSON.parse(message.toString());
  } catch {
    data = Number(message.toString());
  }

  const count =
    typeof data === "number"
      ? data
      : typeof data === "object" &&
          data !== null &&
          "value" in data &&
          Number.isFinite(Number(data.value))
        ? Number(data.value)
        : Number.NaN;

  if (!Number.isFinite(count)) return;

  const counterId = match[1];
  if (lastCounts.get(counterId) === count) return;
  lastCounts.set(counterId, count);

  const organizationIds = listOrganizationIdsForCounter(counterId);
  void Promise.all(
    organizationIds.map((organizationId) =>
      sendFcmStateToCounter(organizationId, counterId, count),
    ),
  )
    .then(() => {
      console.log("Counter FCM bridge sent state", { counterId, count });
    })
    .catch((error) => {
      console.error("Counter FCM bridge delivery failed", error);
    });
});

client.on("error", (error) => {
  console.error("Counter FCM bridge MQTT error", error);
  process.exitCode = 1;
  client.end(true, () => process.exit(1));
});

client.on("close", () => {
  console.error("Counter FCM bridge MQTT connection closed; exiting for Docker restart");
  process.exit(1);
});
