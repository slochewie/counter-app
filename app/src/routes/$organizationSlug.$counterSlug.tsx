import { createFileRoute } from "@tanstack/react-router";

import { CounterScreen } from "#/components/counter-screen.tsx";

export const Route = createFileRoute("/$organizationSlug/$counterSlug")({
  head: ({ params }) => ({
    meta: [
      { title: "Capacity Counter" },
      {
        name: "apple-mobile-web-app-title",
        content: params.counterSlug || "Counter",
      },
    ],
  }),
  component: CounterRoute,
});

function CounterRoute() {
  const { organizationSlug, counterSlug } = Route.useParams();

  return (
    <CounterScreen
      organizationSlug={organizationSlug}
      counterSlug={counterSlug}
    />
  );
}
