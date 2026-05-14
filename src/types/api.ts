export type AggregatedRow = {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  price_rub: string | number | null;
  city: string | null;
  image_urls: string[] | null;
  fetched_at?: string;
};

export type ListingRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_rub: string | number;
  city: string | null;
  status: string;
  created_at: string;
  images: string[];
};

export type UserRole = "admin" | "moderator" | "user";

export type PendingListingRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_rub: string | number;
  city: string | null;
  description: string | null;
  status: string;
  created_at: string;
  owner_email: string;
  owner_id: string;
  images: string[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
};

export type StatsResponse = {
  aggregated: number;
  publishedListings: number;
  queuePending: number;
};

export type PlatformRow = {
  id: number;
  code: string;
  name: string;
  base_url: string | null;
  is_active: boolean;
};

export type QueueJobRow = {
  id: string;
  status: string;
  scheduled_at: string;
  attempts: number;
  last_error: string | null;
  platform_name: string;
  platform_code: string;
  listing_id: string;
  listing_title: string;
  price_rub: string | number;
};

export type CreateListingResponse = {
  id: string;
  status: string;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};
