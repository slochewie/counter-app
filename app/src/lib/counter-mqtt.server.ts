import mqtt, { type MqttClient } from "mqtt";

import { sendFcmStateToCounter } from "#/lib/fcm-send.server.ts";

export type CounterCommand = "increment" | "decrement" | "reset";

export type CounterState = {
  count: number;
  updatedBy: string | null;
  receivedAt: string;
};

const RESPONSE_TIMEOUT_MS = 5000;

function mqttConfig() {
  const host =
    process.env.MQTT_HOST ??
    process.env.VITE_MQTT_HOST ??
    "wss://mqtt.niteowl.dev";
  const username = process.env.MQTT_USERNAME ?? process.env.VITE_MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD ?? process.env.VITE_MQTT_PASSWORD;

  if (!username || !password) {
    throw new Error("Counter MQTT credentials are not configured.");
  }

  return { host, username, password };
}

function assertCounterId(counterId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(counterId)) {
    throw new Error("Invalid counterId.");
  }
}

function parseCounterState(message: Buffer): CounterState | null {
  const raw = message.toString();

  try {
    let data: unknown = JSON.parse(raw);

    if (typeof data === "number") {
      data = { value: data, updated_by: "mqtt_numeric" };
    }

    if (
      typeof data === "object" &&
      data !== null &&
      "value" in data &&
      Number.isFinite(Number(data.value))
    ) {
      const parsed = data as {
        value: unknown;
        source?: unknown;
        updated_by?: unknown;
      };

      return {
        count: Number(parsed.value),
        updatedBy:
          typeof parsed.updated_by === "string"
            ? parsed.updated_by
            : typeof parsed.source === "string"
              ? parsed.source
              : null,
        receivedAt: new Date().toISOString(),
      };
    }
  } catch {
    const numeric = Number(raw);

    if (Number.isFinite(numeric)) {
      return {
        count: numeric,
        updatedBy: "mqtt_numeric",
        receivedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

function waitForCounterState(
  client: MqttClient,
  counterId: string,
  publish: () => void,
  options: { ignoreRetained?: boolean } = {},
) {
  const stateTopic = `counters/${counterId}/capacity/state`;

  return new Promise<CounterState>((resolve, reject) => {
    let settled = false;

    const finish = (error: Error | null, state?: CounterState) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      client.removeListener("message", onMessage);
      client.end(true);

      if (error) {
        reject(error);
      } else if (state) {
        resolve(state);
      }
    };

    const onMessage = (
      topic: string,
      message: Buffer,
      packet: { retain?: boolean },
    ) => {
      if (
        topic !== stateTopic ||
        (options.ignoreRetained === true && packet.retain === true)
      ) {
        return;
      }

      const state = parseCounterState(message);

      if (state) {
        finish(null, state);
      }
    };

    const timeout = setTimeout(() => {
      finish(new Error("Timed out waiting for Counter state."));
    }, RESPONSE_TIMEOUT_MS);

    client.on("message", onMessage);
    client.subscribe(stateTopic, (error) => {
      if (error) {
        finish(error);
        return;
      }

      publish();
    });
  });
}

function connectCounterClient() {
  const { host, username, password } = mqttConfig();

  return new Promise<MqttClient>((resolve, reject) => {
    const client = mqtt.connect(host, {
      username,
      password,
      reconnectPeriod: 0,
      clean: true,
      clientId: `counter_api_${Math.random().toString(16).slice(2)}`,
    });

    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error("Timed out connecting to Counter MQTT broker."));
    }, RESPONSE_TIMEOUT_MS);

    client.once("connect", () => {
      clearTimeout(timeout);
      resolve(client);
    });

    client.once("error", (error) => {
      clearTimeout(timeout);
      client.end(true);
      reject(error);
    });
  });
}

export async function getCounterState(counterId: string) {
  assertCounterId(counterId);

  const client = await connectCounterClient();
  const getTopic = `counters/${counterId}/capacity/get`;

  return waitForCounterState(client, counterId, () => {
    client.publish(
      getTopic,
      JSON.stringify({ source: "counter_api", location: counterId }),
    );
  });
}

export async function sendCounterCommand(
  counterId: string,
  action: CounterCommand,
  actorId: string,
) {
  assertCounterId(counterId);

  const client = await connectCounterClient();
  const commandTopic = `counters/${counterId}/capacity/command`;

  return waitForCounterState(
    client,
    counterId,
    () => {
      client.publish(
        commandTopic,
        JSON.stringify({
          action,
          source: "counter_api",
          updated_by: "Counter widget",
          updated_by_id: actorId,
          location: counterId,
        }),
      );
    },
    { ignoreRetained: true },
  );
}


let stateListener: MqttClient | null = null;

export function ensureCounterStatePushListener() {
  if (stateListener) return stateListener;

  const { host, username, password } = mqttConfig();
  const client = mqtt.connect(host, {
    username,
    password,
    reconnectPeriod: 5000,
    clean: true,
    clientId: `counter_push_${Math.random().toString(16).slice(2)}`,
  });
  stateListener = client;

  client.on("connect", () => {
    client.subscribe("counters/+/capacity/state", (error) => {
      if (error) {
        console.error("Counter FCM MQTT subscribe failed", error);
      } else {
        console.log("Counter FCM MQTT listener subscribed");
      }
    });
  });

  client.on("message", (topic, message) => {
    const match = /^counters\/([A-Za-z0-9_-]+)\/capacity\/state$/.exec(topic);
    if (!match) return;

    const state = parseCounterState(message);
    if (!state) return;

    const counterId = match[1];
    void sendFcmStateToCounterByCounterId(counterId, state.count).catch((error) => {
      console.error("Counter FCM state delivery failed", error);
    });
  });

  client.on("error", (error) => {
    console.error("Counter FCM MQTT listener error", error);
  });

  return client;
}

async function sendFcmStateToCounterByCounterId(counterId: string, count: number) {
  const { listOrganizationIdsForCounter } = await import("#/lib/push-store.server.ts");
  const organizationIds = listOrganizationIdsForCounter(counterId);
  await Promise.all(
    organizationIds.map((organizationId) =>
      sendFcmStateToCounter(organizationId, counterId, count),
    ),
  );
}
