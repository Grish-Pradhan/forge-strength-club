import Link from 'next/link';
import { Instagram, Twitter, Youtube, MapPin, Mail } from 'lucide-react';
import { BrandMark } from '@/components/logo';

/** Site footer — brand, quick links, contact, hours. */
export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-900">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center">
              <BrandMark />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
              A strength & conditioning club built on iron, coaching and community.
              Show up, put in the work, forge your strongest self.
            </p>
            <div className="mt-6 flex gap-3">
              {[
                { icon: Instagram, label: 'Instagram' },
                { icon: Twitter, label: 'Twitter' },
                { icon: Youtube, label: 'YouTube' },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-all hover:border-ember/50 hover:text-ember"
                >
                  <s.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              Explore
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { href: '/#classes', label: 'Class schedule' },
                { href: '/#amenities', label: 'Amenities' },
                { href: '/#pricing', label: 'Membership plans' },
                { href: '/register', label: 'Join the club' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-white/60 transition-colors hover:text-ember">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              Find us
            </h4>
            <ul className="mt-4 space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-ember" />
                47 Iron Works Ave, District 9
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-none text-ember" />
                train@forgestrength.club
              </li>
              <li className="pt-2 text-white/40">
                Mon–Fri 5:30–22:00 · Sat–Sun 7:00–20:00
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-white/35 sm:flex-row">
          <p>© {new Date().getFullYear()} Forge Strength Club. All rights reserved.</p>
          <p>
            Built with <span className="text-ember">iron</span> and Next.js.
          </p>
        </div>
      </div>
    </footer>
  );
}
