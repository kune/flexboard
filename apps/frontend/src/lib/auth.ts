import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'

const OIDC_AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost/dex'
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'flexboard-web'

export const userManager = new UserManager({
  authority: OIDC_AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
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
