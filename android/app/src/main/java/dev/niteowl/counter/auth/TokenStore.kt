package dev.niteowl.counter.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenStore(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "counter_oauth",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun save(environment: String, token: OAuthToken) {
        prefs.edit()
            .putString("${environment}_access", token.accessToken)
            .putString("${environment}_refresh", token.refreshToken)
            .putLong("${environment}_expires", token.expiresAtEpochSeconds)
            .apply()
    }

    fun load(environment: String): OAuthToken? {
        val access = prefs.getString("${environment}_access", null) ?: return null
        return OAuthToken(
            accessToken = access,
            refreshToken = prefs.getString("${environment}_refresh", null),
            expiresAtEpochSeconds = prefs.getLong("${environment}_expires", 0L),
        )
    }

    fun clear() = prefs.edit().clear().apply()
}

data class OAuthToken(
    val accessToken: String,
    val refreshToken: String?,
    val expiresAtEpochSeconds: Long,
)
