export type MeUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
};

export type MeResponse = {
  user: MeUser | null;
  csrfToken: string;
  compareIds: string[];
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function apiPostJson<T>(
  path: string,
  body: unknown,
  csrfToken: string
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
