import type { Candidate, State } from "./types";

const KEY = "dm.token";

/**
 * The token arrives in the URL hash, which browsers never send to a server and never
 * leak in a Referer header. We stash it and strip it from the address bar on first load.
 */
export function claimToken(): string | null {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9]+)/);
  if (m) {
    localStorage.setItem(KEY, m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  }
  return localStorage.getItem(KEY);
}

export const forgetToken = () => localStorage.removeItem(KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(KEY) ?? "";
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-dm-token": token,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

export const api = {
  state: () => call<State>("/api/state"),
  scrape: (url: string) => call<Candidate>("/api/scrape", { url }),

  createItem: (fields: Record<string, unknown>) => call<State>("/api/item", { action: "create", fields }),
  updateItem: (id: string, fields: Record<string, unknown>) =>
    call<State>("/api/item", { action: "update", id, fields }),
  deleteItem: (id: string) => call<State>("/api/item", { action: "delete", id }),
  moveItem: (id: string, dir: -1 | 1) => call<State>("/api/item", { action: "move", id, dir }),
  setStatus: (id: string, status: string) => call<State>("/api/item", { action: "status", id, status }),

  deposit: (amountCents: number, note?: string) =>
    call<State>("/api/money", { action: "deposit", amountCents, note }),
  allocate: (itemId: string, amountCents: number) =>
    call<State>("/api/money", { action: "allocate", itemId, amountCents }),
  direct: (itemId: string, amountCents: number, note?: string) =>
    call<State>("/api/money", { action: "direct", itemId, amountCents, note }),
  pledge: (itemId: string, amountCents: number) =>
    call<State>("/api/money", { action: "pledge", itemId, amountCents }),
  fulfill: (entryId: string, done: boolean) =>
    call<State>("/api/money", { action: done ? "fulfill" : "unfulfill", entryId }),
  setPot: (amountCents: number) => call<State>("/api/money", { action: "setPot", amountCents }),

  rotate: () => call<{ links: { name: string; role: string; url: string }[] }>("/api/rotate", {}),
};
