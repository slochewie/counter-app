import { useEffect, useState } from "react"
import { OrganizationSelector } from "@niteowl/ui"

import { authClient } from "#/lib/auth-client.ts"
import {
  type AvailableCounter,
  canonicalCounterPath,
} from "#/lib/counter-routes.ts"

type AvailableCountersResponse = {
  counters?: AvailableCounter[]
  error?: string
}

async function counterAuthorizationHeader() {
  const { data, error } = await authClient.token()

  if (error || !data?.token) {
    throw new Error(error?.message ?? "Unable to authenticate this Counter request.")
  }

  return `Bearer ${data.token}`
}

async function loadAvailableCounters(signal: AbortSignal) {
  const authorization = await counterAuthorizationHeader()
  const response = await fetch("/api/counter/available", {
    headers: { authorization },
    signal,
  })
  const result = (await response.json()) as AvailableCountersResponse

  if (!response.ok) {
    throw new Error(result.error ?? "Unable to load available Counters.")
  }

  return Array.isArray(result.counters) ? result.counters : []
}

export function OrganizationHeaderSelector() {
  const { data: session } = authClient.useSession()
  const { data: organizations, isPending: areOrganizationsPending } =
    authClient.useListOrganizations()
  const { data: activeOrganization, isPending: isActiveOrganizationPending } =
    authClient.useActiveOrganization()
  const [availableCounters, setAvailableCounters] = useState<AvailableCounter[]>([])

  useEffect(() => {
    if (!session) {
      setAvailableCounters([])
      return
    }

    const controller = new AbortController()

    void loadAvailableCounters(controller.signal)
      .then((counters) => {
        if (!controller.signal.aborted) {
          setAvailableCounters(counters)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailableCounters([])
        }
      })

    return () => controller.abort()
  }, [session])

  useEffect(() => {
    if (
      !session ||
      areOrganizationsPending ||
      isActiveOrganizationPending ||
      activeOrganization ||
      organizations?.length !== 1
    ) {
      return
    }

    void authClient.organization.setActive({
      organizationId: organizations[0].id,
    })
  }, [
    activeOrganization,
    areOrganizationsPending,
    isActiveOrganizationPending,
    organizations,
    session,
  ])

  if (!session) {
    return null
  }

  return (
    <OrganizationSelector
      variant="compact"
      organizations={organizations ?? []}
      value={activeOrganization?.id}
      loading={areOrganizationsPending || isActiveOrganizationPending}
      className="w-28 min-w-0 sm:w-48 lg:w-56"
      onValueChange={(organizationId) => {
        void authClient.organization.setActive({ organizationId })

        const counter = availableCounters.find(
          (availableCounter) =>
            availableCounter.organizationId === organizationId,
        )

        if (counter) {
          window.location.assign(canonicalCounterPath(counter))
        }
      }}
    />
  )
}
