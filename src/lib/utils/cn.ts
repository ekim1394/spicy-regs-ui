/**
 * Join className fragments, dropping falsy ones and collapsing whitespace so an
 * empty interpolated slot never leaves stray double-spaces. The shared way
 * primitives merge their base classes with a caller's `className`.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
