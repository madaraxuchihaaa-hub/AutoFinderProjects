export type UserRole = "admin" | "moderator" | "user";

export type AuthPayload = {
  userId: string;
  email: string;
  role: UserRole;
};

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
};
