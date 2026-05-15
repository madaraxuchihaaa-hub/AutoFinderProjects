export type AggregatedRow = {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  price_byn?: string | number | null;
  /** @deprecated */
  price_rub?: string | number | null;
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
  price_byn?: string | number;
  price_rub?: string | number;
  city: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_type?: string | null;
  engine_volume_ml?: number | null;
  drivetrain?: string | null;
  color?: string | null;
  vin?: string | null;
  trim_level?: string | null;
  status: string;
  created_at: string;
  images: string[];
  show_phone?: boolean;
  plate_number?: string | null;
};

export type UserRole = "admin" | "moderator" | "user";

export type PendingListingRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_byn?: string | number;
  price_rub?: string | number;
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
  is_blocked?: boolean;
  created_at: string;
  updated_at?: string;
  listings_count?: number;
};

export type AdminUserCreateBody = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role?: "user" | "moderator";
};

export type AdminUserUpdateBody = {
  email?: string;
  full_name?: string;
  phone?: string;
  role?: "user" | "moderator";
  password?: string;
  is_blocked?: boolean;
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
  price_byn?: string | number;
  price_rub?: string | number;
};

export type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string;
  listing_title: string;
  listing_brand: string;
  listing_model: string;
  peer_email: string;
  peer_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_email?: string;
  sender_name?: string | null;
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
  plate_number?: string | null;
  role: UserRole;
};

/** Цена из API (поддержка старого поля price_rub). */
export function readPriceByn(row: {
  price_byn?: string | number | null;
  price_rub?: string | number | null;
}): string | number | null {
  return row.price_byn ?? row.price_rub ?? null;
}

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};
