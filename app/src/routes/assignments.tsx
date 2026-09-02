import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon, UsersIcon } from "lucide-react";

import { Badge } from "#/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx";
import { Input } from "#/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx";
import { Skeleton } from "#/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table.tsx";
import { authBaseURL, authClient } from "#/lib/auth-client.ts";
import {
  type CounterAssignment,
  type EligibleOrganizationMember,
  listCounterAssignments,
  listEligibleOrganizationMembers,
  updateCounterAssignment,
} from "#/lib/counter-access.ts";
import { countersForOrganization } from "#/lib/counter-locations.ts";

export const Route = createFileRoute("/assignments")({
  component: CounterAssignments,
});

function CounterAssignments() {
  const { data: session, isPending } = authClient.useSession();
  const {
    data: organizations,
    isPending: areOrganizationsPending,
  } = authClient.useListOrganizations();
  const {
    data: activeOrganization,
    isPending: isActiveOrganizationPending,
  } = authClient.useActiveOrganization();
  const [members, setMembers] = useState<EligibleOrganizationMember[]>([]);
  const [assignments, setAssignments] = useState<CounterAssignment[]>([]);
  const [assignmentsAvailable, setAssignmentsAvailable] = useState(true);
  const [assignmentsPending, setAssignmentsPending] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isPending || session) return;

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
    if (!session || !activeOrganization?.id) {
      setMembers([]);
      setAssignments([]);
      setAssignmentsAvailable(true);
      setAssignmentsError(null);
      setAssignmentsPending(false);
      return;
    }

    let cancelled = false;

    async function loadAssignments() {
      setAssignmentsPending(true);
      setAssignmentsError(null);

      try {
        const [eligibleMembers, assignmentResult] = await Promise.all([
          listEligibleOrganizationMembers(activeOrganization.id),
          listCounterAssignments(activeOrganization.id),
        ]);

        if (!cancelled) {
          setMembers(eligibleMembers);
          setAssignments(assignmentResult.assignments);
          setAssignmentsAvailable(assignmentResult.available);
          setAssignmentsPending(false);
        }
      } catch (error) {
        if (!cancelled) {
          setMembers([]);
          setAssignments([]);
          setAssignmentsError(
            error instanceof Error
              ? error.message
              : "Unable to load Counter assignments.",
          );
          setAssignmentsPending(false);
        }
      }
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, session]);

  const counters = activeOrganization
    ? countersForOrganization(activeOrganization.name)
    : [];

  const assignmentMap = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [
          assignment.userId,
          new Set(assignment.counterIds),
        ]),
      ),
    [assignments],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;

    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query),
    );
  }, [members, search]);

  async function handleCounterToggle(
    member: EligibleOrganizationMember,
    counterId: string,
  ) {
    if (!activeOrganization?.id || updatingKey || !assignmentsAvailable) return;

    const key = `${member.userId}:${counterId}`;
    const enabled = !(assignmentMap.get(member.userId)?.has(counterId) ?? false);
    setUpdatingKey(key);
    setAssignmentsError(null);

    try {
      const updated = await updateCounterAssignment(
        activeOrganization.id,
        member.userId,
        counterId,
        enabled,
      );

      setAssignments((current) => {
        const next = current.map((assignment) => ({
          ...assignment,
          counterIds: [...assignment.counterIds],
        }));
        const index = next.findIndex(
          (assignment) => assignment.userId === updated.userId,
        );

        if (index === -1) {
          return updated.enabled
            ? [
                ...next,
                {
                  userId: updated.userId,
                  counterIds: [updated.counterId],
                },
              ]
            : next;
        }

        const counterIds = new Set(next[index].counterIds);
        if (updated.enabled) {
          counterIds.add(updated.counterId);
        } else {
          counterIds.delete(updated.counterId);
        }

        next[index] = {
          ...next[index],
          counterIds: [...counterIds],
        };

        return next;
      });
    } catch (error) {
      setAssignmentsError(
        error instanceof Error
          ? error.message
          : "Unable to update Counter assignment.",
      );
    } finally {
      setUpdatingKey(null);
    }
  }

  if (isPending || !session) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </main>
    );
  }

  const organizationList = organizations ?? [];
  const organizationsPending =
    areOrganizationsPending || isActiveOrganizationPending;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
          <UsersIcon />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Choose which Counters each active organization member can access.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Counter access is stored separately for each organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={activeOrganization?.id ?? ""}
            disabled={organizationsPending || organizationList.length === 0}
            onValueChange={(organizationId) => {
              if (organizationId) {
                void authClient.organization.setActive({ organizationId });
              }
            }}
          >
            <SelectTrigger className="w-full sm:max-w-sm">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Counter access</CardTitle>
          <CardDescription>
            Only active organization members are listed. Select a Counter badge to grant or remove access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members"
              className="pl-9"
            />
          </div>

          {!assignmentsAvailable ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Counter assignment storage is not installed on the auth service yet. Member filtering is live, but access badges are read-only until that endpoint is available.
            </p>
          ) : null}

          {assignmentsError ? (
            <p className="text-sm text-destructive">{assignmentsError}</p>
          ) : null}

          {assignmentsPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {!assignmentsPending && activeOrganization && counters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This organization does not have a Counter configured yet.
            </p>
          ) : null}

          {!assignmentsPending && activeOrganization && members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active organization members are available.
            </p>
          ) : null}

          {!assignmentsPending && counters.length > 0 && filteredMembers.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Counters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="min-w-44">
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-max flex-wrap gap-2">
                          {counters.map((counter) => {
                            const enabled =
                              assignmentMap.get(member.userId)?.has(counter.id) ??
                              false;
                            const isUpdating =
                              updatingKey === `${member.userId}:${counter.id}`;

                            return (
                              <Badge
                                key={counter.id}
                                asChild
                                variant={enabled ? "default" : "outline"}
                              >
                                <button
                                  type="button"
                                  disabled={
                                    updatingKey !== null || !assignmentsAvailable
                                  }
                                  aria-pressed={enabled}
                                  onClick={() =>
                                    void handleCounterToggle(member, counter.id)
                                  }
                                  className={
                                    assignmentsAvailable
                                      ? enabled
                                        ? "cursor-pointer"
                                        : "cursor-pointer opacity-45"
                                      : "cursor-not-allowed opacity-45"
                                  }
                                >
                                  {isUpdating ? "Saving…" : counter.name}
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!assignmentsPending && members.length > 0 && filteredMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members match your search.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
