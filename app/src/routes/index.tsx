import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "#/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx";
import { authBaseURL, authClient } from "#/lib/auth-client.ts";
import { counterLocationIdForOrganization } from "#/lib/counter-locations.ts";
import { useCounterMqtt } from "#/lib/use-counter-mqtt.ts";

export const Route = createFileRoute("/")({
  component: CounterApp,
});

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
  const locationId = activeOrganization
    ? counterLocationIdForOrganization(activeOrganization.name)
    : null;
  const { count, status, updatedAt, updatedBy, sendCommand } =
    useCounterMqtt(locationId);

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

  const organizationList = organizations ?? [];
  const organizationsPending =
    areOrganizationsPending || isActiveOrganizationPending;
  const displayName = session.user.name || session.user.email;
  const isConnected = status === "connected";
  const stateTopic = locationId
    ? `counters/${locationId}/capacity/state`
    : "—";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">NiteOwl.dev Counter</p>
            <p className="truncate text-xs text-zinc-400">{displayName}</p>
          </div>

          <div className="flex min-w-0 flex-1 gap-2 sm:ml-auto sm:max-w-md">
            <Select
              value={activeOrganization?.id}
              disabled={organizationsPending || organizationList.length === 0}
              onValueChange={(organizationId) => {
                void authClient.organization.setActive({ organizationId });
              }}
            >
              <SelectTrigger className="min-w-0 flex-1 border-zinc-700 bg-zinc-900 text-zinc-50">
                <SelectValue>
                  {activeOrganization?.name ??
                    (organizationsPending
                      ? "Loading organizations…"
                      : organizationList.length === 0
                        ? "No organizations"
                        : "Select organization")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {organizationList.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="shrink-0 border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white"
              onClick={() => void authClient.signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl p-4 md:p-6">
        <Card className="overflow-hidden border-zinc-800 bg-zinc-900 text-zinc-50 shadow-2xl shadow-black/20">
          <CardHeader className="border-b border-zinc-800 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-xl">Counter</CardTitle>
                <CardDescription className="mt-1 truncate text-zinc-400">
                  {activeOrganization
                    ? activeOrganization.name
                    : "Select an organization to continue."}
                </CardDescription>
              </div>

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

          <CardContent className="space-y-5 p-4 sm:p-6">
            {activeOrganization && !locationId ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
                This organization does not have a Counter location configured yet.
              </div>
            ) : (
              <>
                <div className="flex min-h-44 items-center justify-center rounded-2xl border border-zinc-800 bg-black px-4 py-8 sm:min-h-52">
                  <div className="text-center text-8xl font-black leading-none tracking-tight tabular-nums sm:text-9xl">
                    {count ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="h-24 touch-manipulation rounded-2xl border border-zinc-700 bg-zinc-800 text-4xl font-bold text-white shadow-sm hover:bg-zinc-700 active:scale-[0.98] disabled:bg-zinc-900 disabled:text-zinc-600 sm:h-28 sm:text-5xl"
                    disabled={!isConnected}
                    onClick={() => sendCommand("decrement")}
                  >
                    −1
                  </Button>
                  <Button
                    className="h-24 touch-manipulation rounded-2xl bg-zinc-50 text-4xl font-bold text-zinc-950 shadow-sm hover:bg-white active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-600 sm:h-28 sm:text-5xl"
                    disabled={!isConnected}
                    onClick={() => sendCommand("increment")}
                  >
                    +1
                  </Button>
                </div>

                <Button
                  className="h-14 w-full touch-manipulation rounded-xl border-zinc-700 bg-transparent text-base font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white active:scale-[0.99]"
                  variant="outline"
                  disabled={!isConnected}
                  onClick={() => sendCommand("reset")}
                >
                  Reset
                </Button>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-zinc-800 pt-4 text-xs sm:text-sm">
                  <dt className="text-zinc-500">Topic</dt>
                  <dd className="break-all text-right font-mono text-[11px] text-zinc-400 sm:text-xs">
                    {stateTopic}
                  </dd>

                  <dt className="text-zinc-500">Last update</dt>
                  <dd className="text-right text-zinc-300">
                    {updatedAt ? updatedAt.toLocaleString() : "—"}
                  </dd>

                  <dt className="text-zinc-500">Source</dt>
                  <dd className="text-right text-zinc-300">{updatedBy ?? "—"}</dd>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
