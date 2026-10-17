import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, collectAllPages } from "../lib/api";
import { readStoredSession, signIn, signOut, type StoredSession } from "../lib/auth";
import type { SubjectView, WorkspaceView } from "../lib/contracts";

// The signed-in person, the workspaces they can open and the one they are working in. Every
// workspace-scoped page reads the active workspace from here rather than from the address, so
// switching workspace re-scopes the whole interface at once.

const WORKSPACE_STORAGE_KEY = "raccoon.workspace";

export interface Viewer {
  subjectId: string;
  displayName: string;
}

type SessionState =
  | { status: "signed-out" }
  | { status: "loading" }
  | { status: "failed"; message: string }
  | {
      status: "ready";
      viewer: Viewer;
      workspaces: WorkspaceView[];
      workspace: WorkspaceView | null;
    };

interface SessionValue {
  state: SessionState;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  selectWorkspace: (workspaceId: string) => void;
  /** Takes a workspace created or renamed on a screen into the session, so the switcher shows it at once. */
  rememberWorkspace: (workspace: WorkspaceView) => void;
  retry: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function readStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredWorkspaceId(workspaceId: string): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Remembering the workspace is a convenience; the first one is chosen again after a reload.
  }
}

function chooseWorkspace(workspaces: WorkspaceView[]): WorkspaceView | null {
  const storedId = readStoredWorkspaceId();
  return workspaces.find((workspace) => workspace.id === storedId) ?? workspaces[0] ?? null;
}

async function resolveViewer(subjectId: string): Promise<Viewer> {
  try {
    const subject: SubjectView = await api.me();
    return { subjectId: subject.id, displayName: subject.displayName };
  } catch {
    // A caller without an account record (a bootstrap principal) still has a session.
    return { subjectId, displayName: "Signed in" };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());
  const [state, setState] = useState<SessionState>(() =>
    session === null ? { status: "signed-out" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);

  const endSession = useCallback(() => {
    signOut();
    setSession(null);
    setState({ status: "signed-out" });
  }, []);

  useEffect(() => {
    api.onUnauthorized(endSession);
    return () => {
      api.onUnauthorized(null);
    };
  }, [endSession]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    api.setToken(session.token);
    setState({ status: "loading" });
    Promise.all([
      resolveViewer(session.subjectId),
      collectAllPages((page) => api.listWorkspaces(page)),
    ])
      .then(([viewer, workspaces]) => {
        if (!cancelled) {
          setState({ status: "ready", viewer, workspaces, workspace: chooseWorkspace(workspaces) });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "The server did not answer.";
          setState({ status: "failed", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  const value = useMemo<SessionValue>(
    () => ({
      state,
      signIn: async (username, password) => {
        setSession(await signIn(username, password));
      },
      signOut: endSession,
      selectWorkspace: (workspaceId) => {
        setState((current) => {
          if (current.status !== "ready") {
            return current;
          }
          const workspace = current.workspaces.find((candidate) => candidate.id === workspaceId);
          if (workspace === undefined) {
            return current;
          }
          writeStoredWorkspaceId(workspace.id);
          return { ...current, workspace };
        });
      },
      rememberWorkspace: (workspace) => {
        setState((current) => {
          if (current.status !== "ready") {
            return current;
          }
          const known = current.workspaces.some((candidate) => candidate.id === workspace.id);
          const workspaces = known
            ? current.workspaces.map((candidate) => (candidate.id === workspace.id ? workspace : candidate))
            : [...current.workspaces, workspace];
          return { ...current, workspaces, workspace: current.workspace?.id === workspace.id ? workspace : current.workspace };
        });
      },
      retry: () => {
        setAttempt((current) => current + 1);
      },
    }),
    [state, endSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used inside SessionProvider.");
  }
  return value;
}

/** For pages rendered inside the signed-in shell, where a ready session is guaranteed. */
export function useReadySession() {
  const { state, selectWorkspace, rememberWorkspace, signOut: leave } = useSession();
  if (state.status !== "ready") {
    throw new Error("useReadySession requires a ready session.");
  }
  return { ...state, selectWorkspace, rememberWorkspace, signOut: leave };
}
