import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

// Endpoint base: always derived from the current origin so the same Docker
// image works under any hostname/IP without rebuild.
const OIDC_AUTHORITY = `${window.location.origin}/dex`
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'flexboard-web'

// Canonical Dex issuer — used only for `iss` claim validation in JWTs.
// When the app is accessed from a second URL (e.g. an external domain) the
// tokens still carry the primary deployment's issuer in their `iss` claim.
// Nginx injects this value at container startup via envsubst into /config.js
// (sets window.__FLEXBOARD_DEX_ISSUER__). Falls back to the current origin so
// single-URL deployments and local dev work without any extra configuration.
const CANONICAL_ISSUER: string =
  (window as unknown as { __FLEXBOARD_DEX_ISSUER__?: string }).__FLEXBOARD_DEX_ISSUER__ ||
  OIDC_AUTHORITY

export const userManager = new UserManager({
  authority: OIDC_AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Pre-seed the OIDC metadata so oidc-client-ts skips the discovery fetch.
  // The discovery fetch is a JavaScript fetch() call that can fail with
  // self-signed certificates before the user interacts with the page.
  // Endpoint URLs use the runtime origin; the issuer uses the canonical value
  // so that tokens validate correctly when accessed from a second URL.
  metadata: {
    issuer: CANONICAL_ISSUER,
    authorization_endpoint: `${OIDC_AUTHORITY}/auth`,
    token_endpoint: `${OIDC_AUTHORITY}/token`,
    jwks_uri: `${OIDC_AUTHORITY}/keys`,
    userinfo_endpoint: `${OIDC_AUTHORITY}/userinfo`,
  },
  // Dex's local-password connector does not properly support prompt=none
  // (it shows the login form instead of returning login_required). Disabling
  // automaticSilentRenew prevents the resulting prompt=none redirect loop.
  automaticSilentRenew: false,
})

export function signIn(): Promise<void> {
  return userManager.signinRedirect()
}

export function signInCallback(): Promise<User> {
  return userManager.signinRedirectCallback()
}

export async function signOut(): Promise<void> {
  // Dex does not implement RP-initiated logout (no end_session_endpoint),
  // so we clear the local session and redirect to root, which will trigger
  // a fresh login redirect via AuthGate.
  await userManager.removeUser()
  window.location.href = '/'
}

export function getUser(): Promise<User | null> {
  return userManager.getUser()
}

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser()
  if (!user || user.expired) return null
  return user.access_token
}
