import type { ReactNode } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import {
  Building2Icon,
  GaugeIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "lucide-react"

import { ThemeSwitcher } from "#/components/theme-switcher.tsx"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#/components/ui/avatar.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "#/components/ui/sidebar.tsx"
import { TooltipProvider } from "#/components/ui/tooltip.tsx"
import { authBaseURL, authClient } from "#/lib/auth-client.ts"

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function AppChrome({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data: session } = authClient.useSession()
  const {
    data: organizations,
    isPending: areOrganizationsPending,
  } = authClient.useListOrganizations()
  const {
    data: activeOrganization,
    isPending: isActiveOrganizationPending,
  } = authClient.useActiveOrganization()

  if (!session) {
    return children
  }

  const displayName = session.user.name || session.user.email
  const avatarLabel = getInitials(displayName)
  const organizationList = organizations ?? []
  const organizationsPending =
    areOrganizationsPending || isActiveOrganizationPending
  const consoleBaseURL = authBaseURL.replace(/\/$/, "")

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-4">
            <div className="text-sm font-medium group-data-[collapsible=icon]:hidden">
              NiteOwl
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/"}
                      tooltip="Counter"
                    >
                      <Link to="/">
                        <GaugeIcon />
                        <span>Counter</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Account">
                      <a href={`${consoleBaseURL}/settings/account`}>
                        <UserCircleIcon />
                        <span>Account</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Security">
                      <a href={`${consoleBaseURL}/settings/security`}>
                        <ShieldCheckIcon />
                        <span>Security</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Organizations">
                      <a href={`${consoleBaseURL}/settings/organizations`}>
                        <Building2Icon />
                        <span>Organizations</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="bg-transparent">
          <header className="flex min-h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
            <SidebarTrigger />

            <div className="min-w-0 shrink-0">
              <p className="truncate text-sm font-semibold">Counter</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                NiteOwl.dev
              </p>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Select
                value={activeOrganization?.id ?? ""}
                disabled={organizationsPending || organizationList.length === 0}
                onValueChange={(organizationId) => {
                  if (organizationId) {
                    void authClient.organization.setActive({ organizationId })
                  }
                }}
              >
                <SelectTrigger className="w-28 min-w-0 sm:w-56">
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

              <ThemeSwitcher inline />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open account menu for ${displayName}`}
                  >
                    <Avatar>
                      {session.user.image ? (
                        <AvatarImage src={session.user.image} alt="" />
                      ) : null}
                      <AvatarFallback>{avatarLabel}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {session.user.image ? (
                            <AvatarImage src={session.user.image} alt="" />
                          ) : null}
                          <AvatarFallback>{avatarLabel}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{displayName}</p>
                          {session.user.email ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {session.user.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => void authClient.signOut()}>
                      <LogOutIcon />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex flex-1 flex-col [&>header:first-child]:hidden">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
