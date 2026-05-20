/**
 * Unit tests for AuthService — signUp, signIn, signOut, error paths.
 */

jest.mock('../lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

import { AuthService } from '../services/AuthService';

// ─── Supabase auth mock builder ─────────────────────────────────────────────────

function createMockClient(overrides: {
  signUpResult?: { data: any; error: any };
  signInResult?: { data: any; error: any };
  getSessionResult?: { data: any; error: any };
  profileResult?: { data: any; error: any };
} = {}) {
  const profileResult = overrides.profileResult ?? {
    data: {
      id: 'user-1',
      role: 'customer',
      full_name: 'Test User',
      email: 'test@example.com',
      phone: null,
      avatar_url: null,
      food_memory: null,
    },
    error: null,
  };

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(profileResult),
  };

  const client = {
    auth: {
      signUp: jest.fn().mockResolvedValue(
        overrides.signUpResult ?? {
          data: { user: { id: 'user-1' }, session: {} },
          error: null,
        },
      ),
      signInWithPassword: jest.fn().mockResolvedValue(
        overrides.signInResult ?? {
          data: { user: { id: 'user-1' }, session: {} },
          error: null,
        },
      ),
      getSession: jest.fn().mockResolvedValue(
        overrides.getSessionResult ?? {
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        },
      ),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn().mockReturnValue(queryBuilder),
  };

  return { client: client as any, queryBuilder };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  describe('signIn', () => {
    it('returns user on successful sign-in', async () => {
      const { client } = createMockClient();
      const svc = new AuthService(client);

      const result = await svc.signIn('test@example.com', 'password123');
      expect(result.user).not.toBeNull();
      expect(result.user!.email).toBe('test@example.com');
      expect(result.user!.role).toBe('customer');
      expect(result.error).toBeUndefined();
    });

    it('returns error when credentials are wrong', async () => {
      const { client } = createMockClient({
        signInResult: {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        },
      });
      const svc = new AuthService(client);

      const result = await svc.signIn('bad@email.com', 'wrong');
      expect(result.user).toBeNull();
      expect(result.error).toBe('Invalid login credentials');
    });

    it('returns error when profile not found', async () => {
      const { client } = createMockClient({
        profileResult: { data: null, error: null },
      });
      const svc = new AuthService(client);

      const result = await svc.signIn('test@example.com', 'password123');
      expect(result.user).toBeNull();
      expect(result.error).toContain('Profile not found');
    });
  });

  describe('signUp', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    it('returns user on successful sign-up', async () => {
      const { client } = createMockClient();
      const svc = new AuthService(client);

      const promise = svc.signUp('new@example.com', 'pass123', 'New User', 'customer');
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(result.user).not.toBeNull();
      expect(result.user!.name).toBe('Test User');
      expect(result.error).toBeUndefined();
      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass123',
        options: { data: { full_name: 'New User', role: 'customer' } },
      });
    });

    it('returns error when sign-up fails', async () => {
      const { client } = createMockClient({
        signUpResult: {
          data: { user: null, session: null },
          error: { message: 'Email already registered' },
        },
      });
      const svc = new AuthService(client);

      const promise = svc.signUp('dup@example.com', 'pass', 'Dup', 'customer');
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(result.user).toBeNull();
      expect(result.error).toBe('Email already registered');
    });

    it('returns error when profile trigger fails', async () => {
      const { client } = createMockClient({
        profileResult: { data: null, error: null },
      });
      const svc = new AuthService(client);

      const promise = svc.signUp('x@example.com', 'pass', 'X', 'customer');
      await jest.runAllTimersAsync();
      const result = await promise;
      expect(result.user).toBeNull();
      expect(result.error).toContain('Profile not created');
    });
  });

  describe('signOut', () => {
    it('calls auth.signOut', async () => {
      const { client } = createMockClient();
      const svc = new AuthService(client);

      await svc.signOut();
      expect(client.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('returns user when session exists', async () => {
      const { client } = createMockClient();
      const svc = new AuthService(client);

      const result = await svc.initialize();
      expect(result.user).not.toBeNull();
      expect(result.user!.email).toBe('test@example.com');
    });

    it('returns null when no session', async () => {
      const { client } = createMockClient({
        getSessionResult: { data: { session: null }, error: null },
      });
      const svc = new AuthService(client);

      const result = await svc.initialize();
      expect(result.user).toBeNull();
    });

    it('returns error when session fetch fails', async () => {
      const { client } = createMockClient({
        getSessionResult: { data: { session: null }, error: { message: 'Network error' } },
      });
      const svc = new AuthService(client);

      const result = await svc.initialize();
      expect(result.user).toBeNull();
      expect(result.error).toBe('Network error');
    });
  });
});
