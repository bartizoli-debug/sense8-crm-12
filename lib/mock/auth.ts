// A stand-in for supabase.auth backed by the in-memory database.
//
// There is no real identity provider locally: any email/password is accepted,
// and the app starts already signed in as the demo user so `/` is reachable
// without a login round-trip. Set NEXT_PUBLIC_MOCK_AUTOLOGIN=false to land on
// the login page instead.

import { DEMO_USER } from './seed';

const SESSION_KEY = 'sense8-crm.mock-session.v1';

const isBrowser = typeof window !== 'undefined';

/** Role claim handed to the demo session; 'admin' unlocks every editor. */
const MOCK_ROLE = process.env.NEXT_PUBLIC_MOCK_ROLE || 'admin';

export interface MockUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  phone: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MockSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: MockUser;
}

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
type AuthListener = (event: AuthEvent, session: MockSession | null) => void;

const listeners = new Set<AuthListener>();

let session: MockSession | null = null;
let initialized = false;

function autoLoginEnabled() {
  return process.env.NEXT_PUBLIC_MOCK_AUTOLOGIN !== 'false';
}

function buildSession(email: string): MockSession {
  const now = new Date().toISOString();
  return {
    access_token: `mock-access-token.${Math.random().toString(36).slice(2)}`,
    refresh_token: `mock-refresh-token.${Math.random().toString(36).slice(2)}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: DEMO_USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      phone: '',
      // `crm_role` is the claim the deal editor checks before unlocking edits.
      app_metadata: { provider: 'mock', providers: ['mock'], crm_role: MOCK_ROLE },
      user_metadata: { full_name: DEMO_USER.full_name, crm_role: MOCK_ROLE },
      created_at: now,
      updated_at: now,
    },
  };
}

function persistSession() {
  if (!isBrowser) return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore private-mode / quota failures.
  }
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const restored = JSON.parse(raw) as MockSession;
        // Rebuild sessions stored before the role claim existed.
        session = restored?.user?.app_metadata?.crm_role
          ? restored
          : buildSession(restored?.user?.email || DEMO_USER.email);
      }
    } catch {
      session = null;
    }
  }

  if (!session && autoLoginEnabled()) {
    session = buildSession(DEMO_USER.email);
    persistSession();
  }
}

function emit(event: AuthEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch (err) {
      console.error('[mock-db] auth listener failed', err);
    }
  });
}

export const mockAuth = {
  async getSession() {
    ensureInitialized();
    return { data: { session }, error: null };
  },

  async getUser() {
    ensureInitialized();
    return { data: { user: session?.user ?? null }, error: null };
  },

  async signInWithPassword({ email }: { email: string; password?: string }) {
    ensureInitialized();
    session = buildSession(email || DEMO_USER.email);
    persistSession();
    emit('SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },

  async signInWithOtp({ email }: { email: string; options?: unknown }) {
    ensureInitialized();
    // No mailbox locally, so the "magic link" signs you straight in.
    session = buildSession(email || DEMO_USER.email);
    persistSession();
    emit('SIGNED_IN');
    return { data: { user: session.user, session }, error: null };
  },

  async signUp({ email }: { email: string; password?: string }) {
    return mockAuth.signInWithPassword({ email });
  },

  async signOut() {
    session = null;
    persistSession();
    emit('SIGNED_OUT');
    return { error: null };
  },

  async refreshSession() {
    ensureInitialized();
    return { data: { session, user: session?.user ?? null }, error: null };
  },

  async updateUser(attributes: Record<string, any>) {
    ensureInitialized();
    if (session) {
      session.user = { ...session.user, ...attributes, updated_at: new Date().toISOString() };
      persistSession();
      emit('USER_UPDATED');
    }
    return { data: { user: session?.user ?? null }, error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    ensureInitialized();
    listeners.add(callback);

    // supabase-js replays the current session asynchronously on subscribe.
    Promise.resolve().then(() => {
      if (listeners.has(callback)) callback('INITIAL_SESSION', session);
    });

    return {
      data: {
        subscription: {
          id: `mock-sub-${Math.random().toString(36).slice(2)}`,
          callback,
          unsubscribe() {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};
