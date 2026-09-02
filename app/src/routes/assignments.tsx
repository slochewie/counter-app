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
  type CounterManagementAccess,
  type EligibleOrganizationMember,
  getCounterManagementAccess,
  listCounterAssignments,
  listCounterManagers,
  listEligibleOrganizationMembers,
  updateCounterAssignment,
  updateCounterManager,
} from "#/lib/counter-access.ts";
import { countersForOrganization } from "#/lib/counter-locations.ts";

export const Route = createFileRoute("/assignments")({
  component: CounterAssignments,
});

function CounterAssignments() {
  const { data: session, isPending } = authClient.useSession();
  const { data: organizations, isPending: areOrganizationsPending } =
    authClient.useListOrganizations();
  const {
    data: activeOrganization,
    isPending: isActiveOrganizationPending,
  } = authClient.useActiveOrganization();
  const [members, setMembers] = useState<EligibleOrganizationMember[]>([]);
  const [assignments, setAssignments] = useState<CounterAssignment[]>([]);
  const [managerUserIds, setManagerUserIds] = useState<string[]>([]);
  const [managementAccess, setManagementAccess] =
    useState<CounterManagementAccess | null>(null);
  const [assignmentsAvailable, setAssignmentsAvailable] = useState(true);
  const [assignmentsPending, setAssignmentsPending] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const isGlobalAdmin = session?.user.role === "admin";

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
      setManagerUserIds([]);
      setManagementAccess(null);
      setAssignmentsAvailable(true);
      setAssignmentsError(null);
      setAssignmentsPending(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadAssignments() {
      setAssignmentsPending(true);
      setAssignmentsError(null);
      setManagementAccess(null);

      try {
        const access = isGlobalAdmin
          ? {
              allowed: true,
              canManageManagers: true,
            }
          : await getCounterManagementAccess(
              activeOrganization.id,
              controller.signal,
            );

        if (cancelled) return;

        if (!access.allowed) {
          window.location.replace("/");
          return;
        }

        setManagementAccess(access);

        const memberResult = await Promise.resolve()
          .then(() => listEligibleOrganizationMembers(activeOrganization.id))
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error }));

        const assignmentResult = await Promise.resolve()
          .then(() => listCounterAssignments(activeOrganization.id))
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error }));

        const managerResult = await Promise.resolve()
          .then(() => listCounterManagers(activeOrganization.id))
          .then((value) => ({ ok: true as const, value }))
          .catch((error: unknown) => ({ ok: false as const, error }));

        if (cancelled) return;

        const errors: string[] = [];

        if (memberResult.ok) {
          setMembers(memberResult.value);
        } else {
          setMembers([]);
          errors.push(
            `Members: ${memberResult.error instanceof Error ? memberResult.error.message : "Unable to load active organization members."}`,
          );
        }

        if (assignmentResult.ok) {
          setAssignments(assignmentResult.value.assignments);
          setAssignmentsAvailable(assignmentResult.value.available);
        } else {
          setAssignments([]);
          setAssignmentsAvailable(false);
          errors.push(
            `Assignments: ${assignmentResult.error instanceof Error ? assignmentResult.error.message : "Unable to load Counter assignments."}`,
          );
        }

        if (managerResult.ok) {
          setManagerUserIds(managerResult.value.managerUserIds);
          setManagementAccess({
            allowed: true,
            canManageManagers:
              access.canManageManagers && managerResult.value.canManageManagers,
          });
        } else {
          setManagerUserIds([]);
          errors.push(
            `Managers: ${managerResult.error instanceof Error ? managerResult.error.message : "Unable to load Counter managers."}`,
          );
        }

        setAssignmentsError(errors.length > 0 ? errors.join(" · ") : null);
        setAssignmentsPending(false);
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setMembers([]);
          setAssignments([]);
          setManagerUserIds([]);
          setManagementAccess(null);
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
      controller.abort();
    };
  }, [activeOrganization?.id, isGlobalAdmin, session]);

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

  const managerSet = useMemo(() => new Set(managerUserIds), [managerUserIds]);

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

    const key = `${member.userId}:counter:${counterId}`;
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

  async function handleManagerToggle(member: EligibleOrganizationMember) {
    if (
      !activeOrganization?.id ||
      updatingKey ||
      !managementAccess?.canManageManagers
    ) {
      return;
    }

    const key = `${member.userId}:manager`;
    const enabled = !managerSet.has(member.userId);
    setUpdatingKey(key);
    setAssignmentsError(null);

    try {
      const updated = await updateCounterManager(
        activeOrganization.id,
        member.userId,
        enabled,
      );

      setManagerUserIds((current) => {
        const next = new Set(current);
        if (updated.enabled) {
          next.add(updated.userId);
        } else {
          next.delete(updated.userId);
        }
        return [...next];
      });
    } catch (error) {
      setAssignmentsError(
        error instanceof Error
          ? error.message
          : "Unable to update Counter manager.",
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
            Manage Counter access for active organization members.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Counter access and Counter Managers are stored separately for each organization.
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
            Only active organization members are listed. Counter Managers can grant or remove Counter access. Organization owners and admins can also designate Counter Managers.
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
            <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Counter assignment storage is not available. Member filtering is live, but access badges are read-only.
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
                    {managementAccess?.canManageManagers ? (
                      <TableHead>Manager</TableHead>
                    ) : null}
                    <TableHead>Counters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => {
                    const isManager = managerSet.has(member.userId);
                    const managerUpdating =
                      updatingKey === `${member.userId}:manager`;

                    return (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="min-w-44">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </TableCell>
                        {managementAccess?.canManageManagers ? (
                          <TableCell>
                            <Badge
                              asChild
                              variant={isManager ? "default" : "outline"}
                            >
                              <button
                                type="button"
                                disabled={updatingKey !== null}
                                aria-pressed={isManager}
                                onClick={() => void handleManagerToggle(member)}
                                className={
                                  isManager
                                    ? "cursor-pointer"
                                    : "cursor-pointer opacity-45"
                                }
                              >
                                {managerUpdating ? "Saving…" : "Manager"}
                              </button>
                            </Badge>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="flex min-w-max flex-wrap gap-2">
                            {counters.map((counter) => {
                              const enabled =
                                assignmentMap.get(member.userId)?.has(counter.id) ??
                                false;
                              const isUpdating =
                                updatingKey ===
                                `${member.userId}:counter:${counter.id}`;

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
                    );
                  })}
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
