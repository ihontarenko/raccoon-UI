// Interim local authentication: the owner-password login issues a bearer token that every
// protected call carries. A browser session / external identity is a later backend track; until
// then the token and the subject it belongs to live in localStorage so a reload keeps the session.

import { api } from "./api";

const SESSION_STORAGE_KEY = "raccoon.session";

export interface StoredSession {
  token: string;
  subjectId: string;
}

function isStoredSession(candidate: unknown): candidate is StoredSession {
  if (candidate === null || typeof candidate !== "object") {
    return false;
  }
  const record = candidate as Record<string, unknown>;
  return typeof record.token === "string" && typeof record.subjectId === "string";
}

export function readStoredSession(): StoredSession | null {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null): void {
  try {
    if (session === null) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // A private window or blocked storage is acceptable; the session simply will not survive a reload.
  }
}

export async function signIn(username: string, password: string): Promise<StoredSession> {
  const response = await api.login(username, password);
  const session = { token: response.token, subjectId: response.credential.subjectId };
  api.setToken(session.token);
  writeStoredSession(session);
  return session;
}

export function signOut(): void {
  api.setToken(null);
  writeStoredSession(null);
}
