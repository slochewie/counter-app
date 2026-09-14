package dev.niteowl.counter.auth

import dev.niteowl.counter.data.CounterEnvironment

data class OAuthConfig(
    val authBaseUrl: String,
    val counterBaseUrl: String,
) {
    companion object {
        const val CLIENT_ID = "ANDROID_OAUTH_CLIENT_ID_PLACEHOLDER"
        const val REDIRECT_URI = "dev.niteowl.counter.android:/oauth/callback"
        const val CALLBACK_SCHEME = "dev.niteowl.counter.android"
        val SCOPES = listOf("openid", "offline_access", "counter:read", "counter:write")

        fun forEnvironment(environment: CounterEnvironment): OAuthConfig = when (environment) {
            CounterEnvironment.NITEOWL -> OAuthConfig(
                authBaseUrl = "https://console.niteowl.dev",
                counterBaseUrl = "https://counter.niteowl.dev",
            )
            CounterEnvironment.MCCARTHYS -> OAuthConfig(
                authBaseUrl = "https://console.mccarthysirishpub.com",
                counterBaseUrl = "https://counter.mccarthysirishpub.com",
            )
        }
    }
}
