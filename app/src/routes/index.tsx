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

      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Counter</CardTitle>
            <CardDescription>
              {activeOrganization
                ? `Active organization: ${activeOrganization.name}`
                : "Select an organization to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Counter controls and live MQTT state will be wired in here next.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
