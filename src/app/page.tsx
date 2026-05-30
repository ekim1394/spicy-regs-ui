import { redirect } from 'next/navigation';

/** `/` redirects to the About page, the product's front door. */
export default function HomePage() {
  redirect('/about');
}
