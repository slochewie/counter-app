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
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-4 md:p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>NiteOwl.dev Counter</CardTitle>
            <CardDescription>
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">NiteOwl.dev Counter</p>
            <p className="truncate text-xs text-muted-foreground">{displayName}</p>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Select
              value={activeOrganization?.id}
              disabled={organizationsPending || organizationList.length === 0}
              onValueChange={(organizationId) => {
                void authClient.organization.setActive({ organizationId });
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue
                  placeholder={
                    organizationsPending
                      ? "Loading organizations…"
                      : organizationList.length === 0
                        ? "No organizations"
                        : "Select organization"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {organizationList.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => void authClient.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Counter</CardTitle>
            <CardDescription>
              {activeOrganization
                ? `Active organization: ${activeOrganization.name}`
                : "Select an organization to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeOrganization && !locationId ? (
              <p className="text-sm text-muted-foreground">
                This organization does not have a Counter location configured yet.
              </p>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-7xl font-bold tabular-nums">
                    {count ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    disabled={!isConnected}
                    onClick={() => sendCommand("decrement")}
                  >
                    -1
                  </Button>
                  <Button
                    size="lg"
                    disabled={!isConnected}
                    onClick={() => sendCommand("increment")}
                  >
                    +1
                  </Button>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  size="lg"
                  disabled={!isConnected}
                  onClick={() => sendCommand("reset")}
                >
                  Reset
                </Button>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-right capitalize">{status}</dd>

                  <dt className="text-muted-foreground">Topic</dt>
                  <dd className="break-all text-right font-mono text-xs">
                    {stateTopic}
                  </dd>

                  <dt className="text-muted-foreground">Last update</dt>
                  <dd className="text-right">
                    {updatedAt ? updatedAt.toLocaleString() : "—"}
                  </dd>

                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="text-right">{updatedBy ?? "—"}</dd>
                </dl>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
