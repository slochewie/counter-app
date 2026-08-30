import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { Button } from "#/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import { authBaseURL, authClient } from "#/lib/auth-client.ts";
import { counterLocationIdForOrganization } from "#/lib/counter-locations.ts";
import { useCounterMqtt } from "#/lib/use-counter-mqtt.ts";

export const Route = createFileRoute("/")({
  component: CounterApp,
});

const RESET_HOLD_MS = 800;

function CounterApp() {
  const { data: session, isPending } = authClient.useSession();
  const {
    data: organizations,
    isPending: areOrganizationsPending,
  } = authClient.useListOrganizations();
  const {
    data: activeOrganization,
    isPending: isActiveOrganizationPending,
  } = authClient.useActiveOrganization();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isResetHolding, setIsResetHolding] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationId = activeOrganization
    ? counterLocationIdForOrganization(activeOrganization.name)
    : null;
  const actor = session
    ? {
        id: session.user.id,
        name: session.user.name || session.user.email,
      }
    : null;
  const { count, status, updatedAt, updatedBy, sendCommand } =
    useCounterMqtt(locationId, actor);

  useEffect(() => {
    if (isPending || session) {
      return;
    }

    const redirectTo = encodeURIComponent(window.location.href);
    const signInURL = `${authBaseURL.replace(/\/$/, "")}/auth/sign-in?redirectTo=${redirectTo}`;

    window.location.replace(signInURL);
  }, [isPending, session]);

  useEffect(() => {
    if (
      !session ||
      areOrganizationsPending ||
      isActiveOrganizationPending ||
      activeOrganization ||
      organizations?.length !== 1
    ) {
      return;
    }

    void authClient.organization.setActive({
      organizationId: organizations[0].id,
    });
  }, [
    activeOrganization,
    areOrganizationsPending,
    isActiveOrganizationPending,
    organizations,
    session,
  ]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function cancelResetHold() {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setIsResetHolding(false);
  }

  function startResetHold() {
    if (!isConnected || resetTimerRef.current) {
      return;
    }

    setIsResetHolding(true);
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null;
      setIsResetHolding(false);
      sendCommand("reset");
    }, RESET_HOLD_MS);
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-50">
        <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-50">
          <CardHeader>
            <CardTitle>NiteOwl.dev Counter</CardTitle>
            <CardDescription className="text-zinc-400">
              {isPending ? "Checking your session…" : "Redirecting to sign in…"}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const isConnected = status === "connected";
  const stateTopic = locationId
    ? `counters/${locationId}/capacity/state`
    : "—";

  return (
    <main className="min-h-full bg-zinc-950 text-zinc-50">
      <div className="mx-auto w-full max-w-xl p-3 sm:p-4 md:p-6">
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20">
          <CardHeader className="border-b border-zinc-800 px-4 py-2.5 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg sm:text-xl">Counter</CardTitle>

              <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-zinc-400">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isConnected ? "bg-emerald-500" : "bg-zinc-600"
                  }`}
                />
                <span className="capitalize">{status}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 p-4 sm:space-y-5 sm:p-6">
            {activeOrganization && !locationId ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                This organization does not have a Counter location configured yet.
              </div>
            ) : (
              <>
                <div className="flex h-36 items-center justify-center rounded-2xl border border-zinc-800 bg-black px-4 sm:h-52">
                  <div className="text-center text-7xl font-black leading-none tracking-tight tabular-nums sm:text-9xl">
                    {count ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-1">
                  <Button
                    className="h-20 touch-manipulation rounded-2xl border border-[#d8b63c] border-t-[#ffe77e] bg-[#f5ce45] text-4xl font-bold text-zinc-950 shadow-[0_5px_0_#b28f22,0_8px_14px_rgba(0,0,0,0.28)] transition-[transform,box-shadow,background-color] hover:bg-[#f8d65c] active:translate-y-[3px] active:shadow-[0_2px_0_#b28f22,0_4px_8px_rgba(0,0,0,0.24)] disabled:bg-zinc-900 disabled:text-zinc-600 disabled:shadow-none sm:h-28 sm:text-5xl"
                    disabled={!isConnected}
                    onClick={() => sendCommand("decrement")}
                  >
                    −1
                  </Button>
                  <Button
                    className="h-20 touch-manipulation rounded-2xl border border-[#4667a4] border-t-[#7f9bd5] bg-[#5075bb] text-4xl font-bold text-white shadow-[0_5px_0_#344f87,0_8px_14px_rgba(0,0,0,0.28)] transition-[transform,box-shadow,background-color] hover:bg-[#6085cb] active:translate-y-[3px] active:shadow-[0_2px_0_#344f87,0_4px_8px_rgba(0,0,0,0.24)] disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none sm:h-28 sm:text-5xl"
                    disabled={!isConnected}
                    onClick={() => sendCommand("increment")}
                  >
                    +1
                  </Button>
                </div>

                <Button
                  className={`h-12 w-full touch-manipulation select-none rounded-xl border-t border-t-white/20 text-base font-semibold shadow-[0_4px_0_color-mix(in_oklab,var(--destructive),black_32%),0_7px_12px_rgba(0,0,0,0.24)] transition-[transform,box-shadow,filter] active:translate-y-[2px] active:shadow-[0_2px_0_color-mix(in_oklab,var(--destructive),black_32%),0_3px_7px_rgba(0,0,0,0.2)] disabled:shadow-none sm:h-14 ${
                    isResetHolding
                      ? "translate-y-[2px] brightness-75 shadow-[0_2px_0_color-mix(in_oklab,var(--destructive),black_32%),0_3px_7px_rgba(0,0,0,0.2)]"
                      : ""
                  }`}
                  variant="destructive"
                  disabled={!isConnected}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={startResetHold}
                  onPointerUp={cancelResetHold}
                  onPointerCancel={cancelResetHold}
                  onPointerLeave={cancelResetHold}
                  onKeyDown={(event) => {
                    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                      event.preventDefault();
                      startResetHold();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      cancelResetHold();
                    }
                  }}
                  aria-label="Hold to reset counter"
                >
                  {isResetHolding ? "Keep Holding…" : "Hold Reset"}
                </Button>

                <div className="border-t border-zinc-800 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-full touch-manipulation justify-between px-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    aria-expanded={detailsOpen}
                    onClick={() => setDetailsOpen((open) => !open)}
                  >
                    Details
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                    />
                  </Button>

                  {detailsOpen ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-2 pb-1 pt-2 text-xs sm:text-sm">
                      <dt className="text-zinc-500">Topic</dt>
                      <dd className="break-all text-right font-mono text-[11px] text-zinc-400 sm:text-xs">
                        {stateTopic}
                      </dd>

                      <dt className="text-zinc-500">Last update</dt>
                      <dd className="text-right text-zinc-300">
                        {updatedAt ? updatedAt.toLocaleString() : "—"}
                      </dd>

                      <dt className="text-zinc-500">Source</dt>
                      <dd className="text-right text-zinc-300">
                        {updatedBy ?? "—"}
                      </dd>
                    </dl>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
