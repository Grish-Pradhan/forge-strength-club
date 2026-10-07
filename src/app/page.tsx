import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { ClassSchedule } from '@/components/landing/class-schedule';
import { Pricing } from '@/components/landing/pricing';
import { Footer } from '@/components/landing/footer';
import { Reveal } from '@/components/landing/reveal';
import { Megaphone } from 'lucide-react';
import {
  getAnnouncements,
  getAmenities,
  getPlans,
  getSiteContent,
  getUpcomingClasses,
} from '@/lib/services/public';

/**
 * Public landing page (Server Component).
 * Parallel-fetches all public data; every read degrades gracefully to
 * static fallback data when Supabase isn't configured or fails.
 *
 * Performance: the public reads use a cookieless anon client (no dynamic
 * APIs in this tree), so the page is statically generated and revalidated
 * in the background every 30s (ISR) — visitors get an instant cached
 * response instead of waiting for live Supabase roundtrips. Admin content
 * edits appear on the landing page within 30 seconds.
 */
export const revalidate = 30;

export default async function LandingPage() {
  const [{ classes }, { plans }, announcements, amenities, { content }] = await Promise.all([
    getUpcomingClasses(),
    getPlans(),
    getAnnouncements(),
    getAmenities(),
    getSiteContent(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main>
        <Hero
          headline={content.hero_headline}
          subhead={content.hero_subhead}
          cta={content.hero_cta}
          imageUrl={content.hero_image_url}
        />

        {/* Announcements marquee (managed from the Admin Panel) */}
        {announcements.length > 0 && (
          <div className="overflow-hidden border-y border-ember/25 bg-ember/5 py-3">
            <div className="flex w-max animate-marquee gap-16">
              {[...announcements, ...announcements].map((a, i) => (
                <span
                  key={`${a.id}-${i}`}
                  className="flex items-center gap-2.5 whitespace-nowrap text-sm text-white/70"
                >
                  <Megaphone className="h-4 w-4 text-ember" />
                  <span className="font-semibold text-bone">{a.title}</span>
                  <span className="text-white/40">— {a.body}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <Features
          amenities={amenities}
          title={content.features_title}
          subhead={content.features_subhead}
        />

        <ClassSchedule classes={classes} />

        <Pricing plans={plans} title={content.pricing_title} subhead={content.pricing_subhead} />

        {/* Final CTA band */}
        <section className="relative overflow-hidden bg-ink-800 py-24">
          <div className="grid-texture absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-ember/15 via-transparent to-gold/10" />
          <Reveal className="relative z-10 mx-auto max-w-3xl px-4 text-center">
            <h2 className="font-display text-5xl text-bone sm:text-6xl">
              THE IRON IS <span className="text-ember">WAITING</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
              First week free for new members. No pressure, no contracts — just show up and lift.
            </p>
            <a
              href="/register"
              className="btn-ember mt-8 inline-block rounded-xl px-10 py-4 text-lg font-bold text-ink-800"
            >
              Start your first week free
            </a>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
