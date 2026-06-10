/**
 * Fixed inner width for the global app chrome (Header + Footer).
 *
 * Matches every route's content `maxWidth` (now a uniform 4xl), so the logo /
 * search / nav and the footer links align flush with the content column on every
 * page. Kept as a single shared constant so the chrome stays in lockstep with
 * the content width if it ever changes again.
 */
export const APP_FRAME = 'max-w-4xl';
