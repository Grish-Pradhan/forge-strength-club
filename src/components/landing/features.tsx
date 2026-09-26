import {
  Dumbbell,
  Flame,
  Users,
  Waves,
  HeartPulse,
  ClipboardList,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from './reveal';

/**
 * Amenities — Bento Grid 2.0: varied cell spans instead of a boring
 * uniform 3-card row. Large feature tile + supporting glass tiles.
 */

const AMENITIES = [
  {
    icon: Dumbbell,
    title: 'Elite Strength Floor',
    description:
      'Competition-grade platforms, calibrated plates, dumbbells to 60kg. Everything you need to chase PRs — and nothing you don’t.',
    span: 'md:col-span-2 md:row-span-2',
    big: true,
  },
  {
    icon: Flame,
    title: 'HIIT Arena',
    description: 'Sled track, assault bikes, ropes and rig.',
    span: '',
    big: false,
  },
  {
    icon: Waves,
    title: 'Recovery Lab',
    description: 'Sauna + cold plunge, included with Forge plans.',
    span: '',
    big: false,
  },
  {
    icon: ClipboardList,
    title: 'Personal Training',
    description: '1-on-1 coaching with video review and periodised programming.',
    span: 'md:col-span-2',
    big: false,
  },
  {
    icon: Users,
    title: 'Community That Shows Up',
    description: 'In-house meets, team WODs and a floor culture built on effort.',
    span: 'md:col-span-2',
    big: false,
  },
  {
    icon: HeartPulse,
    title: 'Body-Comp Scanning',
    description: 'Monthly InBody scans so progress is measured, not guessed.',
    span: '',
    big: false,
  },
];

export function Features({ title, subhead }: { title: string; subhead: string }) {
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
          {AMENITIES.map((a) => (
            <RevealItem key={a.title} className={a.span}>
              <div
                className={`glass-card card-lift group flex h-full flex-col p-6 ${
                  a.big ? 'justify-end md:p-8' : ''
                }`}
              >
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ember/15 transition-colors group-hover:bg-ember/25 ${
                    a.big ? 'order-first mb-6 h-14 w-14' : ''
                  }`}
                >
                  <a.icon
                    className={`text-ember ${a.big ? 'h-7 w-7' : 'h-5 w-5'}`}
                    strokeWidth={2}
                  />
                </div>
                <h3
                  className={`font-semibold text-bone ${a.big ? 'font-display text-3xl tracking-wide' : 'text-lg'}`}
                >
                  {a.title}
                </h3>
                <p className={`mt-2 leading-relaxed text-white/55 ${a.big ? 'text-base' : 'text-sm'}`}>
                  {a.description}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
