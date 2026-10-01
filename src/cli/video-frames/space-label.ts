import type { VolumeSpace } from "./destination";

/** Inspected capacity is advisory, not a reservation or an output-size estimate. */
export function frameSpaceLabel(space: VolumeSpace): string {
  if (space.status !== "known" || space.availableBytes === undefined || space.availableBytes < 0n)
    return "Available space unknown";
  const bytes = space.availableBytes;
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];
  let divisor = 1n;
  let index = 0;
  while (index < units.length - 1 && bytes >= divisor * 1024n) {
    divisor *= 1024n;
    index++;
  }
  const amount =
    index === 0 ? String(bytes) : `${bytes / divisor}.${((bytes % divisor) * 10n) / divisor}`;
  return `Available space: ${amount} ${units[index]} (advisory)`;
}
