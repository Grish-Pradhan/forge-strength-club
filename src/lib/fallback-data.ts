import type { Announcement, ClassWithCount, Plan } from './types';

/**
 * Static fallback data.
 *
 * Used when Supabase is not configured (missing .env.local) or when a public
 * read fails — so the landing page ALWAYS renders instead of erroring out.
 * Real deployments serve live data; this is pure graceful degradation.
 */

export const FALLBACK_CLASSES: ClassWithCount[] = [
  { id: 'fb-1', title: 'Strength Foundations', description: 'Barbell fundamentals: squat, hinge, press. Perfect for beginners who want to lift with confidence.', trainer_name: 'Maya Kowalski', schedule_time: futureISO(1, 6), capacity: 16, category: 'Strength', image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80', booked_count: 12 },
  { id: 'fb-2', title: 'HIIT Furnace', description: '45 minutes of pure engine work. Sleds, ropes, bikes — leave nothing in the tank.', trainer_name: 'Deon Richards', schedule_time: futureISO(1, 7.25), capacity: 20, category: 'HIIT', image_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80', booked_count: 20 },
  { id: 'fb-3', title: 'Mobility & Breath', description: 'Deep mobility flow paired with breathwork to reset your nervous system after heavy training.', trainer_name: 'Priya Nair', schedule_time: futureISO(1, 12), capacity: 14, category: 'Yoga & Mobility', image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&q=80', booked_count: 8 },
  { id: 'fb-4', title: 'CrossFit WOD', description: 'The workout of the day, Forge style. Scalable for all levels — bring your engine.', trainer_name: 'Sam Tran', schedule_time: futureISO(1, 18.5), capacity: 18, category: 'CrossFit', image_url: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=900&q=80', booked_count: 15 },
  { id: 'fb-5', title: 'Power Hour', description: 'Max-effort strength work. Squat, bench, dead. Coached platform time with video review.', trainer_name: 'Maya Kowalski', schedule_time: futureISO(2, 6), capacity: 16, category: 'Strength', image_url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=900&q=80', booked_count: 11 },
  { id: 'fb-6', title: 'Bag Work Basics', description: 'Boxing fundamentals on the heavy bags. Footwork, combos, conditioning.', trainer_name: 'Costas Vela', schedule_time: futureISO(2, 8), capacity: 12, category: 'Boxing', image_url: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=900&q=80', booked_count: 6 },
  { id: 'fb-7', title: 'Forge Conditioning', description: 'Partner-based conditioning circuits. Expect odd objects, carries and a serious sweat.', trainer_name: 'Deon Richards', schedule_time: futureISO(3, 17), capacity: 20, category: 'HIIT', image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=900&q=80', booked_count: 17 },
  { id: 'fb-8', title: 'Sunday Reset Yoga', description: 'Slow flow + long holds. Start your week recovered, not wrecked.', trainer_name: 'Priya Nair', schedule_time: futureISO(4, 10), capacity: 14, category: 'Yoga & Mobility', image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80', booked_count: 9 },
];

export const FALLBACK_PLANS: Plan[] = [
  { id: 'fb-plan-1', name: 'Iron', price: 2500, billing_cycle: 'monthly', features: ['Full gym floor access', 'Locker room + showers', '1 guest pass / month', 'Member app + class booking'], is_active: true, sort_order: 0 },
  { id: 'fb-plan-2', name: 'Forge', price: 4000, billing_cycle: 'monthly', features: ['Everything in Iron', 'Unlimited group classes', 'Sauna + cold plunge', '2 guest passes / month', 'Monthly body-comp scan'], is_active: true, sort_order: 1 },
  { id: 'fb-plan-3', name: 'Forge Elite', price: 35000, billing_cycle: 'annual', features: ['Everything in Forge', '4 personal training sessions / month', 'Priority class booking', 'Nutrition coaching', 'Forge Elite merch kit'], is_active: true, sort_order: 2 },
];

export const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'fb-an-1', title: 'New cold plunge installed', body: 'The recovery lab is live — sauna + cold plunge now included with Forge and Forge Elite memberships.', is_active: true },
  { id: 'fb-an-2', title: 'Powerlifting meet — Oct 18', body: 'Our first in-house meet. Squat, bench, dead. Sign up at the front desk — spectator entry is free.', is_active: true },
];

export const FALLBACK_SITE_CONTENT: Record<string, string> = {
  hero_headline: 'FORGE YOUR STRONGEST SELF',
  hero_subhead: 'No shortcuts. No mirrors-and-music fluff. Just iron, coaching that cares, and a community that shows up.',
  hero_cta: 'Join Now',
  features_title: 'BUILT LIKE A WEAPON',
  features_subhead: "Everything you need to get strong — and nothing you don't.",
  pricing_title: 'MEMBERSHIP PLANS',
  pricing_subhead: 'Simple pricing in Nepali Rupees. Pay online with eSewa or Khalti. Cancel anytime.',
};

/** Helper: ISO timestamp `days` from now at hour `h` (supports .25/.5/.75). */
function futureISO(days: number, h: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
  return d.toISOString();
}
