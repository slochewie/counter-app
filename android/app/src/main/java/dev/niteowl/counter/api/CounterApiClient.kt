package dev.niteowl.counter.api

import dev.niteowl.counter.auth.OAuthClient
import dev.niteowl.counter.auth.OAuthConfig
import dev.niteowl.counter.data.CounterCommand
import dev.niteowl.counter.data.CounterEnvironment
import dev.niteowl.counter.data.CounterSelection
import dev.niteowl.counter.data.CounterSnapshot
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class CounterApiClient(private val oauth: OAuthClient) {
    suspend fun availableCounters(environment: CounterEnvironment): List<CounterSelection> {
        val config = OAuthConfig.forEnvironment(environment)
        val json = JSONObject(request(environment, "${config.counterBaseUrl}/api/counter/available", "GET"))
        val array: JSONArray = json.getJSONArray("counters")
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                add(
                    CounterSelection(
                        organizationId = item.getString("organizationId"),
                        organizationName = item.getString("organizationName"),
                        counterId = item.getString("counterId"),
                        environment = environment,
                    ),
                )
            }
        }
    }

    suspend fun state(selection: CounterSelection): CounterSnapshot {
        val config = OAuthConfig.forEnvironment(selection.environment)
        val url = "${config.counterBaseUrl}/api/counter/state?organizationId=${encode(selection.organizationId)}&counterId=${encode(selection.counterId)}"
        val json = JSONObject(request(selection.environment, url, "GET"))
        return snapshot(selection, json.getInt("count"))
    }

    suspend fun send(selection: CounterSelection, command: CounterCommand): CounterSnapshot {
        val config = OAuthConfig.forEnvironment(selection.environment)
        val body = JSONObject()
            .put("organizationId", selection.organizationId)
            .put("counterId", selection.counterId)
            .put("action", command.wireValue)
            .toString()
        val json = JSONObject(request(selection.environment, "${config.counterBaseUrl}/api/counter/command", "POST", body))
        return snapshot(selection, json.getInt("count"))
    }

    suspend fun registerFcmToken(selection: CounterSelection, token: String) {
        val config = OAuthConfig.forEnvironment(selection.environment)
        val body = JSONObject()
            .put("organizationId", selection.organizationId)
            .put("counterId", selection.counterId)
            .put("token", token)
            .toString()
        request(selection.environment, "${config.counterBaseUrl}/api/push/fcm", "POST", body)
    }

    private fun snapshot(selection: CounterSelection, count: Int) = CounterSnapshot(
        organizationId = selection.organizationId,
        organizationName = selection.organizationName,
        counterId = selection.counterId,
        count = count,
    )

    private suspend fun request(environment: CounterEnvironment, url: String, method: String, body: String? = null): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            setRequestProperty("Authorization", "Bearer ${oauth.validAccessToken(environment)}")
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        if (body != null) connection.outputStream.use { it.write(body.toByteArray()) }
        val responseCode = connection.responseCode
        val response = (if (responseCode in 200..299) connection.inputStream else connection.errorStream)
            .bufferedReader().use { it.readText() }
        if (responseCode !in 200..299) error("Counter API request failed ($responseCode): $response")
        return response
    }

    private fun encode(value: String): String = URLEncoder.encode(value, Charsets.UTF_8)
}
