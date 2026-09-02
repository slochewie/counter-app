const LOCATION_ALIASES: Record<string, string> = {
  mccarthys: "mccarthys",
  "mccarthys irish pub": "mccarthys",
  library: "library",
  "the library": "library",
  "frog and peach": "frog_peach",
  "frog peach": "frog_peach",
  bulls: "bulls",
  "bulls tavern": "bulls",
};

export type CounterDefinition = {
  id: string;
  name: string;
  locationId: string;
};

export function normalizeOrganizationName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/'/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function counterLocationIdForOrganization(name: string) {
  return LOCATION_ALIASES[normalizeOrganizationName(name)] ?? null;
}

export function countersForOrganization(name: string): CounterDefinition[] {
  const locationId = counterLocationIdForOrganization(name);

  if (!locationId) {
    return [];
  }

  return [
    {
      id: locationId,
      name: "Capacity Counter",
      locationId,
    },
  ];
}
