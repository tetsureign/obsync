export function currentInstantIso(): string {
  return Temporal.Now.instant().toString({ smallestUnit: 'millisecond' });
}
