/** Marker for "the selected items disagree on this value" (bulk editing). */
export interface Mixed {
  readonly __mixed: true;
}
export const MIXED: Mixed = Object.freeze({ __mixed: true as const });
export type Common<T> = T | Mixed;

export const isMixed = (v: unknown): v is Mixed => v === MIXED;

/**
 * The value shared by every entry, or `MIXED` when they differ (or when there are none).
 * `equals` defaults to `Object.is`; pass a deep comparison for objects.
 */
export function commonValue<T>(values: readonly T[], equals: (a: T, b: T) => boolean = Object.is): Common<T> {
  if (values.length === 0) return MIXED;
  const [first, ...rest] = values;
  return rest.every((v) => equals(first, v)) ? first : MIXED;
}

/** Deep-ish equality for plain JSON data (actions, small objects). */
export const jsonEquals = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);
