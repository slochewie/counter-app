package dev.niteowl.counter.auth

import android.net.Uri
import dev.niteowl.counter.data.CounterEnvironment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

class OAuthClient(private val tokenStore: TokenStore) {
    private val pending = ConcurrentHashMap<CounterEnvironment, PendingAuthorization>()

    data class PendingAuthorization(val state: String, val verifier: String)

    fun authorizationUri(environment: CounterEnvironment): Uri {
        val config = OAuthConfig.forEnvironment(environment)
        val pkce = Pkce.generate()
        val state = java.util.UUID.randomUUID().toString()
        pending[environment] = PendingAuthorization(state, pkce.verifier)

        return Uri.parse("${config.authBaseUrl}/api/auth/oauth2/authorize").buildUpon()
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("client_id", OAuthConfig.CLIENT_ID)
            .appendQueryParameter("redirect_uri", OAuthConfig.REDIRECT_URI)
            .appendQueryParameter("scope", OAuthConfig.SCOPES.joinToString(" "))
            .appendQueryParameter("resource", config.counterBaseUrl)
            .appendQueryParameter("state", state)
            .appendQueryParameter("code_challenge", pkce.challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .build()
    }

    suspend fun exchangeCallback(environment: CounterEnvironment, callback: Uri): OAuthToken {
        val error = callback.getQueryParameter("error")
        if (error != null) error("OAuth failed: ${callback.getQueryParameter("error_description") ?: error}")

        val current = pending.remove(environment) ?: error("No OAuth authorization is pending.")
        require(callback.getQueryParameter("state") == current.state) { "OAuth state did not match." }
        val code = callback.getQueryParameter("code") ?: error("OAuth callback did not contain a code.")
        val config = OAuthConfig.forEnvironment(environment)

        val token = postForm(
            "${config.authBaseUrl}/api/auth/oauth2/token",
            mapOf(
                "grant_type" to "authorization_code",
                "client_id" to OAuthConfig.CLIENT_ID,
                "redirect_uri" to OAuthConfig.REDIRECT_URI,
                "code" to code,
                "code_verifier" to current.verifier,
                "resource" to config.counterBaseUrl,
            ),
        )
        tokenStore.save(environment.name, token)
        return token
    }

    suspend fun validAccessToken(environment: CounterEnvironment): String {
        val token = tokenStore.load(environment.name) ?: error("Sign in required.")
        val now = System.currentTimeMillis() / 1000
        if (token.expiresAtEpochSeconds > now + 60 || token.refreshToken.isNullOrBlank()) return token.accessToken

        val config = OAuthConfig.forEnvironment(environment)
        val refreshed = postForm(
            "${config.authBaseUrl}/api/auth/oauth2/token",
            mapOf(
                "grant_type" to "refresh_token",
                "client_id" to OAuthConfig.CLIENT_ID,
                "refresh_token" to token.refreshToken,
                "resource" to config.counterBaseUrl,
            ),
        )
        tokenStore.save(environment.name, refreshed)
        return refreshed.accessToken
    }

    fun clear() = tokenStore.clear()

    private suspend fun postForm(url: String, fields: Map<String, String>): OAuthToken = withContext(Dispatchers.IO) {
        val body = fields.entries.joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, Charsets.UTF_8)}=${URLEncoder.encode(value, Charsets.UTF_8)}"
        }
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            setRequestProperty("Accept", "application/json")
        }
        connection.outputStream.use { it.write(body.toByteArray()) }
        val responseCode = connection.responseCode
        val responseText = (if (responseCode in 200..299) connection.inputStream else connection.errorStream)
            .bufferedReader().use { it.readText() }
        if (responseCode !in 200..299) error("OAuth token request failed: $responseText")

        val json = JSONObject(responseText)
        val expiresIn = json.optLong("expires_in", 3600L)
        OAuthToken(
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token").ifBlank { null },
            expiresAtEpochSeconds = System.currentTimeMillis() / 1000 + expiresIn,
        )
    }
}
