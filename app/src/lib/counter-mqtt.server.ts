import mqtt, { type IClientOptions, type MqttClient } from "mqtt";

import {
  getCounterProvisioning,
  type CounterProvisioning,
} from "#/lib/push-auth.server.ts";
import { counterLocationIdForOrganization } from "#/lib/counter-locations.ts";

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

type CounterMqttRoute = {
  config: CounterMqttConfig;
  mqttTopicId: string;
};

const counterRouteCache = new Map<string, string>();

function normalizeTopicPrefix(topicPrefix: string) {
  const trimmed = topicPrefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function mqttConfig(provisioning: CounterProvisioning): CounterMqttConfig {
  const { mqtt: mqttProvisioning } = provisioning;
  const websocketConfigured =
    mqttProvisioning.websocketHost &&
    mqttProvisioning.websocketPort &&
    mqttProvisioning.websocketProtocol;
  const url = websocketConfigured
    ? `${mqttProvisioning.websocketProtocol}://${mqttProvisioning.websocketHost}:${mqttProvisioning.websocketPort}`
    : `${mqttProvisioning.protocol}://${mqttProvisioning.host}:${mqttProvisioning.port}`;

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

function legacyCounterLocationId(
  provisioning: CounterProvisioning,
  counterId: string,
) {
  const legacyLocationId = counterLocationIdForOrganization(
    provisioning.organization.name,
  );

  return legacyLocationId === counterId ? legacyLocationId : null;
}

function counterMqttTopicId(
  provisioning: CounterProvisioning,
  counterId: string,
) {
  return legacyCounterLocationId(provisioning, counterId) ?? counterId;
}

function routeCacheKey(organizationId: string, counterId: string) {
  return `${organizationId}:${counterId}`;
}

function counterMqttRoutes(
  provisioning: CounterProvisioning,
  counterId: string,
): CounterMqttRoute[] {
  const mqttTopicId = counterMqttTopicId(provisioning, counterId);
  const configured = mqttConfig(provisioning);

  if (legacyCounterLocationId(provisioning, counterId)) {
    return [
      {
        config: {
          ...configured,
          topicPrefix: "",
        },
        mqttTopicId,
      },
    ];
  }

  if (!configured.topicPrefix) {
    return [{ config: configured, mqttTopicId }];
  }

  return [
    { config: configured, mqttTopicId },
    {
      config: {
        ...configured,
        topicPrefix: "",
      },
      mqttTopicId,
    },
  ];
}

function cachedCounterRoute(
  organizationId: string,
  counterId: string,
  routes: CounterMqttRoute[],
) {
  const cachedPrefix = counterRouteCache.get(
    routeCacheKey(organizationId, counterId),
  );

  if (cachedPrefix === undefined) {
    return null;
  }

  return (
    routes.find((route) => route.config.topicPrefix === cachedPrefix) ?? null
  );
}

function rememberCounterRoute(
  organizationId: string,
  counterId: string,
  route: CounterMqttRoute,
) {
  counterRouteCache.set(
    routeCacheKey(organizationId, counterId),
    route.config.topicPrefix,
  );
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
      finish(
        new Error(
          `Timed out waiting for Counter state on ${stateTopic}.`,
        ),
      );
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

function waitForCounterStateAcrossRoutes(
  client: MqttClient,
  routes: CounterMqttRoute[],
  publish: () => void,
) {
  const stateTopics = routes.map((route) =>
    counterTopic(route.config, route.mqttTopicId, "state"),
  );

  return new Promise<{ state: CounterState; route: CounterMqttRoute }>(
    (resolve, reject) => {
      let settled = false;

      const finish = (
        error: Error | null,
        result?: { state: CounterState; route: CounterMqttRoute },
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        client.removeListener("message", onMessage);
        client.end(true);

        if (error) {
          reject(error);
        } else if (result) {
          resolve(result);
        }
      };

      const onMessage = (topic: string, message: Buffer) => {
        const route = routes.find(
          (candidate) =>
            counterTopic(
              candidate.config,
              candidate.mqttTopicId,
              "state",
            ) === topic,
        );

        if (!route) {
          return;
        }

        const state = parseCounterState(message);

        if (state) {
          finish(null, { state, route });
        }
      };

      const timeout = setTimeout(() => {
        finish(
          new Error(
            `Timed out waiting for Counter state on ${stateTopics.join(
              " or ",
            )}.`,
          ),
        );
      }, RESPONSE_TIMEOUT_MS);

      client.on("message", onMessage);
      client.subscribe(stateTopics, (error) => {
        if (error) {
          finish(error);
          return;
        }

        publish();
      });
    },
  );
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

async function discoverCounterRoute(
  organizationId: string,
  counterId: string,
  routes: CounterMqttRoute[],
) {
  const cached = cachedCounterRoute(organizationId, counterId, routes);

  if (cached) {
    return cached;
  }

  if (routes.length === 1) {
    rememberCounterRoute(organizationId, counterId, routes[0]);
    return routes[0];
  }

  const client = await connectCounterClient(routes[0].config);
  const result = await waitForCounterStateAcrossRoutes(
    client,
    routes,
    () => {
      for (const route of routes) {
        client.publish(
          counterTopic(route.config, route.mqttTopicId, "get"),
          JSON.stringify({
            source: "counter_api",
            location: route.mqttTopicId,
          }),
        );
      }
    },
  );

  rememberCounterRoute(organizationId, counterId, result.route);
  return result.route;
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
  const routes = counterMqttRoutes(provisioning, counterId);
  const cached = cachedCounterRoute(organizationId, counterId, routes);

  if (cached) {
    const client = await connectCounterClient(cached.config);
    const getTopic = counterTopic(
      cached.config,
      cached.mqttTopicId,
      "get",
    );
    const state = await waitForCounterState(
      client,
      cached.config,
      cached.mqttTopicId,
      () => {
        client.publish(
          getTopic,
          JSON.stringify({
            source: "counter_api",
            location: cached.mqttTopicId,
          }),
        );
      },
    );

    return {
      ...state,
      stateTopic: counterTopic(
        cached.config,
        cached.mqttTopicId,
        "state",
      ),
    };
  }

  const client = await connectCounterClient(routes[0].config);
  const result = await waitForCounterStateAcrossRoutes(
    client,
    routes,
    () => {
      for (const route of routes) {
        client.publish(
          counterTopic(route.config, route.mqttTopicId, "get"),
          JSON.stringify({
            source: "counter_api",
            location: route.mqttTopicId,
          }),
        );
      }
    },
  );

  rememberCounterRoute(organizationId, counterId, result.route);

  return {
    ...result.state,
    stateTopic: counterTopic(
      result.route.config,
      result.route.mqttTopicId,
      "state",
    ),
  };
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
  const routes = counterMqttRoutes(provisioning, counterId);
  const route = await discoverCounterRoute(
    organizationId,
    counterId,
    routes,
  );
  const commandTopic = counterTopic(
    route.config,
    route.mqttTopicId,
    "command",
  );
  const stateTopic = counterTopic(
    route.config,
    route.mqttTopicId,
    "state",
  );

  const client = await connectCounterClient(route.config);

  const state = await waitForCounterState(
    client,
    route.config,
    route.mqttTopicId,
    () => {
      client.publish(
        commandTopic,
        JSON.stringify({
          action,
          source: "counter_api",
          updated_by: "Counter widget",
          updated_by_id: actorId,
          location: route.mqttTopicId,
        }),
      );
    },
    { ignoreRetained: true },
  );

  return {
    ...state,
    stateTopic,
  };
}
