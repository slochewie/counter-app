# NiteOwl Counter for Android

Native Android companion for the NiteOwl Counter service. The app mirrors the native iOS companion using Kotlin and Jetpack Compose.

## Current state

The initial scaffold includes:

- Jetpack Compose dark UI matching the iOS Counter app
- native/public OAuth Authorization Code + PKCE flow
- encrypted local OAuth token storage
- refresh-token handling
- assigned Counter discovery
- current Counter state
- increment, decrement, and reset commands
- selected Counter and cached count persistence
- silent foreground refresh every two seconds
- Settings and Sign Out account menu

The Android OAuth client still needs to be registered in the NiteOwl Better Auth provider. Until then, replace `ANDROID_OAUTH_CLIENT_ID_PLACEHOLDER` in `app/src/main/java/dev/niteowl/counter/auth/OAuthConfig.kt` with the registered Android native/public client ID.

Recommended redirect URI:

`dev.niteowl.counter.android:/oauth/callback`

Scopes:

`openid offline_access counter:read counter:write`

Resources:

- `https://counter.niteowl.dev`
- `https://counter.mccarthysirishpub.com`

No client secret belongs in this app.

## Open in Android Studio

Open the `android` directory as the Android Studio project. The project targets Android SDK 37, uses JDK 17, Android Gradle Plugin 9.4.0, Kotlin/Compose compiler plugin 2.3.21, and the stable Compose BOM 2026.08.00.

This connector-created scaffold does not include the binary Gradle wrapper JAR. Android Studio can still import the Gradle build; if it asks for a Gradle distribution, select/download Gradle 9.6.0 and then generate the wrapper once locally.

## Deferred for the next pass

- Android home-screen widget equivalent to the iOS WidgetKit widget
- Firebase Cloud Messaging native push notifications
- final NiteOwl app icon assets
- physical-device validation
