import { createFileRoute } from "@tanstack/react-router";

import { CounterScreen } from "#/components/counter-screen.tsx";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Capacity Counter" }] }),
  component: CounterApp,
});

function CounterApp() {
  return <CounterScreen />;
}
