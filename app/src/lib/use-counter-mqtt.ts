import { useCallback, useEffect, useRef, useState } from "react";
import mqtt, { type MqttClient } from "mqtt";

export type CounterAction = "increment" | "decrement" | "reset";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "error"
  | "unconfigured";

export function useCounterMqtt(locationId: string | null) {
  const clientRef = useRef<MqttClient | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  useEffect(() => {
    setCount(null);
    setUpdatedAt(null);
    setUpdatedBy(null);

    if (!locationId) {
      setStatus("idle");
      return;
    }

    const mqttHost =
      import.meta.env.VITE_MQTT_HOST ?? "wss://mqtt.niteowl.dev";
    const username = import.meta.env.VITE_MQTT_USERNAME;
    const password = import.meta.env.VITE_MQTT_PASSWORD;

    if (!username || !password) {
      setStatus("unconfigured");
      return;
    }

    const stateTopic = `counters/${locationId}/capacity/state`;
    const getTopic = `counters/${locationId}/capacity/get`;

    setStatus("connecting");

    const client = mqtt.connect(mqttHost, {
      username,
      password,
      reconnectPeriod: 2000,
      clean: true,
      clientId: `counter_web_${Math.random().toString(16).slice(2)}`,
    });

    clientRef.current = client;

    client.on("connect", () => {
      setStatus("connected");
      client.subscribe(stateTopic);
      client.publish(
        getTopic,
        JSON.stringify({ source: "web_page", location: locationId }),
      );
    });

    client.on("message", (topic, message) => {
      if (topic !== stateTopic) {
        return;
      }

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

          setCount(Number(parsed.value));
          setUpdatedAt(new Date());
          setUpdatedBy(
            typeof parsed.source === "string"
              ? parsed.source
              : typeof parsed.updated_by === "string"
                ? parsed.updated_by
                : null,
          );
        }
      } catch {
        const numeric = Number(raw);

        if (Number.isFinite(numeric)) {
          setCount(numeric);
          setUpdatedAt(new Date());
          setUpdatedBy("mqtt_numeric");
        }
      }
    });

    client.on("offline", () => {
      setStatus("offline");
    });

    client.on("error", (error) => {
      console.error("Counter MQTT error", error);
      setStatus("error");
    });

    return () => {
      if (clientRef.current === client) {
        clientRef.current = null;
      }

      client.end(true);
    };
  }, [locationId]);

  const sendCommand = useCallback(
    (action: CounterAction) => {
      const client = clientRef.current;

      if (!client || !client.connected || !locationId) {
        setStatus("offline");
        return false;
      }

      client.publish(
        `counters/${locationId}/capacity/command`,
        JSON.stringify({
          action,
          source: "web_page",
          location: locationId,
        }),
      );

      return true;
    },
    [locationId],
  );

  return {
    count,
    status,
    updatedAt,
    updatedBy,
    sendCommand,
  };
}
