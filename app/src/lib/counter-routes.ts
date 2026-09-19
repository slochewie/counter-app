export type AvailableCounter = {
  organizationId: string;
  organizationName: string;
  counterId: string;
  counterName: string;
};

export function counterKey(counter: AvailableCounter) {
  return `${counter.organizationId}:${counter.counterId}`;
}

export function slugifyCounterSegment(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "counter";
}

export function canonicalCounterPath(counter: AvailableCounter) {
  return `/${slugifyCounterSegment(counter.organizationName)}/${slugifyCounterSegment(
    counter.counterName,
  )}`;
}

export function findCounterBySlugs(
  counters: AvailableCounter[],
  organizationSlug: string,
  counterSlug: string,
) {
  return counters.find(
    (counter) =>
      slugifyCounterSegment(counter.organizationName) === organizationSlug &&
      slugifyCounterSegment(counter.counterName) === counterSlug,
  );
}
