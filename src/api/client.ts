import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { getStoredAccessToken } from "../auth/tokenBridge";

const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

/** В бандл подставляется при сборке; если пусто — Railway URL не задан. */
export function hasRemoteApiUrl(): boolean {
  return Boolean(envUrl);
}

/** Установленное приложение (APK), а не Expo Go — без .env при сборке API не настроить. */
export function isStandaloneAppWithoutApiEnv(): boolean {
  if (hasRemoteApiUrl()) return false;
  const e = Constants.executionEnvironment;
  return e === ExecutionEnvironment.Bare || e === ExecutionEnvironment.Standalone;
}

function metroLanHost(): string | null {
  const raw =
    Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;
  if (!raw) return null;
  const host = raw.replace(/^https?:\/\//, "").split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

export function getApiBaseUrl(): string {
  if (envUrl) return envUrl.replace(/\/$/, "");

  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production"
  ) {
    return "";
  }

  const lan = metroLanHost();
  if (lan) {
    return `http://${lan}:3000`;
  }

  if (
    Constants.executionEnvironment === ExecutionEnvironment.Bare ||
    Constants.executionEnvironment === ExecutionEnvironment.Standalone
  ) {
    return "https://missing-expo-public-api-url.localhost";
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }
  return "http://localhost:3000";
}

type AuthOption = { auth?: boolean };

async function buildHeaders(
  jsonBody: boolean,
  opts?: AuthOption
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (jsonBody) headers["Content-Type"] = "application/json";
  if (opts?.auth !== false) {
    const t = await getStoredAccessToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

async function parseError(res: Response, text: string): Promise<never> {
  try {
    const j = JSON.parse(text) as { message?: string };
    throw new Error(j.message || text || res.statusText);
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(text || res.statusText);
    throw err;
  }
}

export async function apiGet<T>(path: string, opts?: AuthOption): Promise<T> {
  const base = getApiBaseUrl();
  const headers = await buildHeaders(false, opts);
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    await parseError(res, text);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: AuthOption
): Promise<T> {
  const base = getApiBaseUrl();
  const headers = await buildHeaders(true, opts);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    await parseError(res, text);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  opts?: AuthOption
): Promise<T> {
  const base = getApiBaseUrl();
  const headers = await buildHeaders(true, opts);
  const res = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    await parseError(res, text);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
