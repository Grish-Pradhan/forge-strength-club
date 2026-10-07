/** ---------- Database row types (mirror supabase/schema.sql) ---------- */

/** JSON value shape (matches PostgREST jsonb — defined locally to avoid a
 *  dependency on generated Supabase types). */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = 'admin' | 'member';

export type MembershipStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  membership_status: MembershipStatus;
  join_date: string;
  avatar_url: string | null;
  /** Assigned membership tier (set by admins or a completed payment). */
  plan_id?: string | null;
  /** When the current paid membership expires (set by the payment gateway). */
  membership_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Email-confirmation state from Supabase Auth (auth.users), keyed by user id. */
export interface EmailAuthStatus {
  emailConfirmed: boolean;
  confirmedAt: string | null;
}

export interface GymClass {
  id: string;
  title: string;
  description: string | null;
  trainer_name: string | null;
  schedule_time: string;
  capacity: number;
  category: string;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'attended';

export interface Booking {
  id: string;
  user_id: string;
  class_id: string;
  booking_status: BookingStatus;
  created_at?: string;
  /** Joined class data (returned by queries that join classes). */
  class?: GymClass | null;
}

export interface AdminBookingRow extends Booking {
  profile?: Pick<Profile, 'id' | 'full_name' | 'email' | 'membership_status'> | null;
  class?: GymClass | null;
}

export type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  id: string;
  name: string;
  price: number;
  billing_cycle: BillingCycle;
  features: Json;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}


export interface Announcement {
  id: string;
  title: string;
  body: string | null;
  is_active: boolean;
  created_at?: string;
}

export type AmenityIcon = 'dumbbell' | 'flame' | 'waves' | 'clipboard' | 'users' | 'heart';

export type AmenityLayout = 'standard' | 'wide' | 'large';

export interface Amenity {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  icon_name: AmenityIcon;
  layout: AmenityLayout;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type AuditCategory = 'activity' | 'booking' | 'auth' | 'admin' | 'security';
export type AuditSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface AuditEvent {
  id: string;
  event_type: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  ip_address: string | null;
  path: string | null;
  description: string;
  metadata: Json;
  user_agent: string | null;
  created_at: string;
}

/** ---------- View models ---------- */

/** A class joined with its live booking count. */
export interface ClassWithCount extends GymClass {
  booked_count: number;
}

/** Admin user row — profile joined with plan name + booking stats. */
export interface AdminUserRow extends Profile {
  plan_id?: string | null;
  plan_name?: string | null;
  booking_count?: number;
}

/** ---------- Payments (eSewa / Khalti, NPR) ---------- */

export type PaymentProvider = 'esewa' | 'khalti';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface Payment {
  id: string;
  user_id: string;
  plan_id: string | null;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transaction_uuid: string;
  provider_ref: string | null;
  created_at?: string;
  updated_at?: string;
}
