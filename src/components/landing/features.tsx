import {
  Dumbbell,
  Flame,
  Users,
  Waves,
  HeartPulse,
  ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Amenity, AmenityIcon, AmenityLayout } from '@/lib/types';
import { Reveal, RevealGroup, RevealItem } from './reveal';

/**
 * Amenities — Bento Grid 2.0: varied cell spans instead of a boring
 * uniform 3-card row. Large feature tile + supporting glass tiles.
 */

const ICONS: Record<AmenityIcon, LucideIcon> = {
  dumbbell: Dumbbell,
  flame: Flame,
  waves: Waves,
  clipboard: ClipboardList,
  users: Users,
  heart: HeartPulse,
};

const LAYOUT_CLASSES: Record<AmenityLayout, string> = {
  standard: '',
  wide: 'md:col-span-2',
  large: 'md:col-span-2 md:row-span-2',
};

export function Features({
  amenities,
  title,
  subhead,
}: {
  amenities: Amenity[];
  title: string;
  subhead: string;
}) {
  return (
    <section id="amenities" className="grain-bg relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <span className="mb-3 inline-block text-xs font-bold uppercase tracking-[0.25em] text-ember">
              Amenities
            </span>
            <h2 className="font-display text-5xl text-bone sm:text-6xl">{title}</h2>
            <p className="mt-4 text-lg text-white/60">{subhead}</p>
          </div>
        </Reveal>

        <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {amenities.map((amenity) => {
            const Icon = ICONS[amenity.icon_name] ?? Dumbbell;
            const isLarge = amenity.layout === 'large';

            return (
              <RevealItem key={amenity.id} className={LAYOUT_CLASSES[amenity.layout]}>
                <div
                  className={`glass-card card-lift group flex h-full flex-col overflow-hidden ${
                    isLarge ? 'md:min-h-[31rem]' : ''
                  }`}
                >
                  <div
                    className={`relative overflow-hidden bg-ink-900 ${
                      isLarge ? 'min-h-64 flex-1 md:min-h-72' : 'h-44'
                    }`}
                  >
                    {amenity.image_url ? (
                      // Admin-supplied URLs can come from any image host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={amenity.image_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 grid-texture opacity-40" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink-700/70 to-transparent" />
                  </div>

                  {/* Copy sits on an opaque panel so it never competes with the photo. */}
                  <div className={`relative flex-none border-t border-white/8 bg-ink-700 p-6 ${isLarge ? 'md:p-8' : ''}`}>
                    <div
                      className={`mb-4 inline-flex items-center justify-center rounded-xl bg-ember/15 transition-colors group-hover:bg-ember/25 ${
                        isLarge ? 'h-14 w-14' : 'h-11 w-11'
                      }`}
                    >
                      <Icon
                        className={`text-ember ${isLarge ? 'h-7 w-7' : 'h-5 w-5'}`}
                        strokeWidth={2}
                      />
                    </div>
                    <h3
                      className={`font-semibold text-bone ${
                        isLarge ? 'font-display text-3xl tracking-wide' : 'text-lg'
                      }`}
                    >
                      {amenity.title}
                    </h3>
                    <p
                      className={`mt-2 leading-relaxed text-white/60 ${
                        isLarge ? 'text-base' : 'text-sm'
                      }`}
                    >
                      {amenity.description}
                    </p>
                  </div>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
