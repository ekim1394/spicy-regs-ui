import { redirect } from 'next/navigation';

/**
 * The IA recast retires the old hero/feature-card landing. `/` now redirects to
 * the About page (the ContentPage template), which is the product's front door.
 */
export default function HomePage() {
  redirect('/about');
}
