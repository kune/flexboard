import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

// Endpoint base: always derived from the current origin so the same Docker
// image works under any hostname/IP without rebuild.
// Rauthy serves all OIDC endpoints under the /auth/v1/ prefix.
const OIDC_AUTHORITY = `${window.location.origin}/rauthy/auth/v1`
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'flexboard-web'

// Canonical Rauthy issuer — used only for `iss` claim validation in JWTs.
// Rauthy always uses https:// in the issuer regardless of the deployment's
// listen scheme (it generates a self-signed cert as fallback).
// Nginx injects the correct value at container startup via envsubst into
// /config.js (sets window.__FLEXBOARD_OIDC_ISSUER__).
// In dev (no config.js injection), derive by replacing http:// → https://
// and appending a trailing slash to match Rauthy's issuer format.
const CANONICAL_ISSUER: string =
  (window as unknown as { __FLEXBOARD_OIDC_ISSUER__?: string }).__FLEXBOARD_OIDC_ISSUER__ ||
  OIDC_AUTHORITY.replace(/^http:\/\//, 'https://') + '/'

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
  // Endpoint URLs use the runtime origin (same-origin requests through nginx);
  // the issuer uses the canonical https:// value for JWT iss claim validation.
  metadata: {
    issuer: CANONICAL_ISSUER,
    authorization_endpoint: `${OIDC_AUTHORITY}/oidc/authorize`,
    token_endpoint: `${OIDC_AUTHORITY}/oidc/token`,
    jwks_uri: `${OIDC_AUTHORITY}/oidc/certs`,
    userinfo_endpoint: `${OIDC_AUTHORITY}/oidc/userinfo`,
    end_session_endpoint: `${OIDC_AUTHORITY}/oidc/logout`,
  },
  automaticSilentRenew: false,
})

export function signIn(): Promise<void> {
  return userManager.signinRedirect()
}

export function signInCallback(): Promise<User> {
  return userManager.signinRedirectCallback()
}

export async function signOut(): Promise<void> {
  return userManager.signoutRedirect()
}

export function getUser(): Promise<User | null> {
  return userManager.getUser()
}

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser()
  if (!user || user.expired) return null
  return user.access_token
}
