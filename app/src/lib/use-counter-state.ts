import { useCallback, useEffect, useState } from "react";

import {
  type CounterAction,
  getCounterState,
  sendCounterCommand as sendCounterApiCommand,
} from "#/lib/counter-api.ts";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "error";

const POLL_INTERVAL_MS = 2000;

export function useCounterState(
  organizationId: string | null,
  counterId: string | null,
) {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [stateTopic, setStateTopic] = useState<string | null>(null);

  useEffect(() => {
    setCount(null);
    setUpdatedAt(null);
    setUpdatedBy(null);
    setStateTopic(null);

    if (!organizationId || !counterId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const state = await getCounterState(organizationId, counterId);

        if (cancelled) {
          return;
        }

        setCount(state.count);
        setUpdatedAt(new Date(state.receivedAt));
        setUpdatedBy(state.updatedBy);
        setStateTopic(state.stateTopic);
        setStatus("connected");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Counter state request failed", error);
        setStatus("error");
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => {
            void refresh();
          }, POLL_INTERVAL_MS);
        }
      }
    };

    setStatus("connecting");
    void refresh();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [counterId, organizationId]);

  const sendCommand = useCallback(
    async (action: CounterAction) => {
      if (!organizationId || !counterId) {
        setStatus("offline");
        return false;
      }

      try {
        const state = await sendCounterApiCommand(
          organizationId,
          counterId,
          action,
        );

        setCount(state.count);
        setUpdatedAt(new Date(state.receivedAt));
        setUpdatedBy(state.updatedBy);
        setStateTopic(state.stateTopic);
        setStatus("connected");
        return true;
      } catch (error) {
        console.error("Counter command failed", error);
        setStatus("error");
        return false;
      }
    },
    [counterId, organizationId],
  );

  return {
    count,
    status,
    updatedAt,
    updatedBy,
    stateTopic,
    sendCommand,
  };
}
