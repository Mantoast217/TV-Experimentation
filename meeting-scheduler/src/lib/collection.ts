/**
 * HeroUI's `Select`/`ComboBox` type their `items` prop as `Iterable<T, SelectionMode>`,
 * reusing the built-in `Iterable<T, TReturn>` generic with the selection mode as `TReturn`.
 * A plain array's iterator resolves `TReturn` to `undefined`, so it never structurally
 * matches — this cast documents that mismatch instead of fighting it at every call site.
 */
export function asItems<T, M extends "single" | "multiple" = "single">(
  items: readonly T[],
): Iterable<T, M> {
  return items as unknown as Iterable<T, M>;
}
