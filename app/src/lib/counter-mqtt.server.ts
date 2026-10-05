import mqtt, { type IClientOptions, type MqttClient } from "mqtt";

import {
  getCounterProvisioning,
  type CounterProvisioning,
} from "#/lib/push-auth.server.ts";

export type CounterCommand = "increment" | "decrement" | "reset";

export type CounterState = {
  count: number;
  updatedBy: string | null;
  receivedAt: string;
};

const RESPONSE_TIMEOUT_MS = 5000;

type CounterMqttConfig = {
  url: string;
  username?: string;
  password?: string;
  topicPrefix: string;
};

function normalizeTopicPrefix(topicPrefix: string) {
  const trimmed = topicPrefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function mqttConfig(provisioning: CounterProvisioning): CounterMqttConfig {
  const { mqtt: mqttProvisioning } = provisioning;
  const url =
    `${mqttProvisioning.protocol}://${mqttProvisioning.host}:${mqttProvisioning.port}`;

  return {
    url,
    username: mqttProvisioning.username ?? undefined,
    password: mqttProvisioning.password ?? undefined,
    topicPrefix: normalizeTopicPrefix(mqttProvisioning.topicPrefix),
  };
}

function counterTopic(
  config: CounterMqttConfig,
  counterId: string,
  suffix: "state" | "get" | "command",
) {
  return `${config.topicPrefix}counters/${counterId}/capacity/${suffix}`;
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
  config: CounterMqttConfig,
  counterId: string,
  publish: () => void,
  options: { ignoreRetained?: boolean } = {},
) {
  const stateTopic = counterTopic(config, counterId, "state");

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

function connectCounterClient(config: CounterMqttConfig) {
  return new Promise<MqttClient>((resolve, reject) => {
    const options: IClientOptions = {
      reconnectPeriod: 0,
      clean: true,
      clientId: `counter_api_${Math.random().toString(16).slice(2)}`,
    };

    if (config.username) {
      options.username = config.username;
    }

    if (config.password) {
      options.password = config.password;
    }

    const client = mqtt.connect(config.url, options);

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

export async function getCounterState(
  request: Request,
  organizationId: string,
  counterId: string,
) {
  assertCounterId(counterId);

  const provisioning = await getCounterProvisioning(
    request,
    organizationId,
    counterId,
  );
  const config = mqttConfig(provisioning);
  const client = await connectCounterClient(config);
  const getTopic = counterTopic(config, counterId, "get");

  return waitForCounterState(client, config, counterId, () => {
    client.publish(
      getTopic,
      JSON.stringify({ source: "counter_api", location: counterId }),
    );
  });
}

export async function sendCounterCommand(
  request: Request,
  organizationId: string,
  counterId: string,
  action: CounterCommand,
  actorId: string,
) {
  assertCounterId(counterId);

  const provisioning = await getCounterProvisioning(
    request,
    organizationId,
    counterId,
  );
  const config = mqttConfig(provisioning);
  const client = await connectCounterClient(config);
  const commandTopic = counterTopic(config, counterId, "command");

  return waitForCounterState(
    client,
    config,
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

