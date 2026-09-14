# NiteOwl Counter iOS companion

This directory contains source for the native iPhone companion and WidgetKit extension that authenticate against the existing NiteOwl Better Auth OAuth provider and call the Counter HTTP API.

## Registered OAuth client

- Client ID: `TiwEzVZDCdgvFUGciWMzBfFBqjzhmEXt`
- Application type: native/public
- Token endpoint auth method: `none`
- Redirect URI: `dev.niteowl.counter:/oauth/callback`
- Scopes: `openid offline_access counter:read counter:write`
- Resources:
  - `https://counter.niteowl.dev`
  - `https://counter.mccarthysirishpub.com`

No client secret belongs in the app. Authorization Code + PKCE is required.

## Xcode targets

Create an iOS 17+ app target named `NiteOwlCounter` and a Widget Extension target named `CounterWidget`.

Recommended identifiers:

- App bundle identifier: `dev.niteowl.counter`
- Widget bundle identifier: `dev.niteowl.counter.widget`
- App Group: `group.dev.niteowl.counter`
- Shared Keychain access group: `$(AppIdentifierPrefix)dev.niteowl.counter.shared`

Register the URL scheme `dev.niteowl.counter` on the app target so `dev.niteowl.counter:/oauth/callback` is delivered back to the app.

The app target should own interactive sign-in with `ASWebAuthenticationSession`. The widget must never present interactive authentication. Access and refresh tokens belong in the shared Keychain access group; non-secret selected-counter metadata and cached count may use the App Group container.

## OAuth flow

1. Generate a PKCE verifier/challenge.
2. Open `${authBaseURL}/api/auth/oauth2/authorize` with:
   - `response_type=code`
   - the registered `client_id`
   - registered `redirect_uri`
   - scopes above
   - `resource` equal to the selected Counter origin
   - PKCE `code_challenge` and `code_challenge_method=S256`
3. Exchange the returned authorization code at `${authBaseURL}/api/auth/oauth2/token` with the verifier and no client secret.
4. Persist the returned access and refresh tokens in Keychain.
5. Call Counter HTTP endpoints with `Authorization: Bearer <access-token>`.
6. Use the refresh token when the access token expires. If refresh fails permanently, keep the last cached widget value and require the user to reopen the app to sign in again.

The Counter server already validates the OAuth access-token resource audience and requires `counter:read` for state and `counter:write` for commands.
