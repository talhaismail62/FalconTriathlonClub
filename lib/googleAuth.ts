import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

// Ensures a pending auth session is completed when the browser redirects back.
WebBrowser.maybeCompleteAuthSession();

/**
 * The URL Supabase redirects back to after Google auth. Built by
 * expo-auth-session rather than hand-assembled so it is correct in every
 * runtime: a dev/standalone build resolves it to the app's own scheme
 * (falcontriathlonclub://), while Expo Go resolves it to its exp:// dev URL.
 *
 * Deliberately points at the app root (no '(app)' path): the old code appended
 * '(app)', producing 'falcontriathlonclub://(app)' whose literal parentheses
 * are awkward to allow-list in Supabase. AuthContext's onAuthStateChange routes
 * the user into the app once the session is set, so the path is unnecessary.
 *
 * Whatever this resolves to MUST be listed in Supabase → Authentication →
 * URL Configuration → Redirect URLs, or Supabase rejects the redirect.
 */
export function getGoogleRedirectUri(): string {
  return makeRedirectUri({ scheme: 'falcontriathlonclub' });
}

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'error'; message?: string };

/**
 * Runs the full Google OAuth flow and, on success, installs the session so
 * AuthContext picks it up. Shared by both login and signup so the two screens
 * cannot drift apart. Returns a typed result instead of throwing, so callers
 * decide how to surface each outcome.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = getGoogleRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Without this the SDK may try to auto-open the URL itself; we open it
      // via WebBrowser so we can read the redirect result back.
      skipBrowserRedirect: true,
    },
  });

  if (error) return { ok: false, reason: 'error', message: error.message };
  if (!data?.url) {
    return { ok: false, reason: 'error', message: 'No authentication URL was returned.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // User backed out of the Google screen — not an error worth alerting on.
  if (result.type !== 'success') {
    return { ok: false, reason: 'cancelled' };
  }

  const { access_token, refresh_token } = parseTokensFromRedirect(result.url);
  if (!access_token || !refresh_token) {
    // Auth may have completed server-side (the account can exist) but the
    // tokens didn't come back in the URL — almost always a redirect-URL
    // mismatch between the app and the Supabase allow-list.
    return {
      ok: false,
      reason: 'error',
      message:
        'Signed in with Google, but the app did not receive a session. ' +
        'Check that the redirect URL is allow-listed in Supabase.',
    };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) {
    return { ok: false, reason: 'error', message: sessionError.message };
  }

  // AuthContext's onAuthStateChange handles navigation from here.
  return { ok: true };
}

/**
 * Supabase returns tokens in the URL fragment (#access_token=...&refresh_token=...),
 * but some flows use the query string (?...), so check both.
 */
function parseTokensFromRedirect(url: string): {
  access_token: string | null;
  refresh_token: string | null;
} {
  const fragment = url.split('#')[1] ?? '';
  const query = url.split('?')[1]?.split('#')[0] ?? '';

  const fromFragment = new URLSearchParams(fragment);
  const fromQuery = new URLSearchParams(query);

  return {
    access_token: fromFragment.get('access_token') ?? fromQuery.get('access_token'),
    refresh_token: fromFragment.get('refresh_token') ?? fromQuery.get('refresh_token'),
  };
}
