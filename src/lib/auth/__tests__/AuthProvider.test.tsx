import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider';
import { apiClient } from '@/lib/api/client';
import * as authApi from '@/lib/api/auth';
import type { AuthResponse } from '@/types/auth';

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    setAccessTokenProvider: jest.fn(),
    setTokenRefresher: jest.fn(),
  },
}));

jest.mock('@/lib/api/auth', () => ({
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  getMe: jest.fn(),
  logout: jest.fn(),
}));

function makeSession(overrides?: Partial<AuthResponse>): AuthResponse {
  return {
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'user@example.com', role: 'USER' },
    ...overrides,
  };
}

function TestConsumer() {
  const { status, user, logout, restoreSession } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.email ?? ''}</span>
      <button onClick={() => void restoreSession()}>restore</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function getLatestRefresher(): () => Promise<string | null> {
  const calls = (apiClient.setTokenRefresher as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in loading and transitions to unauthenticated on mount', async () => {
    (authApi.refresh as jest.Mock).mockRejectedValue(new Error('No session'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await waitFor(() => {
      expect(authApi.refresh).toHaveBeenCalled();
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });

  it('single-flights concurrent refresh calls into one network request', async () => {
    let resolveInitialRefresh: (session: AuthResponse) => void = () => {};
    (authApi.refresh as jest.Mock).mockReturnValue(
      new Promise<AuthResponse>((resolve) => {
        resolveInitialRefresh = resolve;
      })
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initial refresh from mount
    const refresher = getLatestRefresher();

    let p1: Promise<string | null>;
    let p2: Promise<string | null>;
    act(() => {
      p1 = refresher();
      p2 = refresher();
    });

    await act(async () => {
      resolveInitialRefresh(makeSession());
      await Promise.all([p1, p2]);
    });

    expect(authApi.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  it('discards a refresh that resolves after logout has already started', async () => {
    let resolveRefresh: (session: AuthResponse) => void = () => {};
    (authApi.refresh as jest.Mock).mockReturnValue(
      new Promise<AuthResponse>((resolve) => {
        resolveRefresh = resolve;
      })
    );
    (authApi.logout as jest.Mock).mockResolvedValue({ revoked: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByText('restore'));
    await waitFor(() => expect(authApi.refresh).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    await act(async () => {
      resolveRefresh(makeSession());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('');
  });

  it('logout calls the server before the access token is cleared', async () => {
    (authApi.refresh as jest.Mock).mockResolvedValue(makeSession());

    let accessTokenDuringLogoutCall: string | null | undefined;
    (authApi.logout as jest.Mock).mockImplementation(async () => {
      const provider = (apiClient.setAccessTokenProvider as jest.Mock).mock.calls[0][0] as () =>
        string | null;
      accessTokenDuringLogoutCall = provider();
      return { revoked: true };
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByText('restore'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(accessTokenDuringLogoutCall).toBe('access-token');
  });
});
