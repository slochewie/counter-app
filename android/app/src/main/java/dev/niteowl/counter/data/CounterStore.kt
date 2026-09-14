package dev.niteowl.counter.data

import android.content.Context

class CounterStore(context: Context) {
    private val prefs = context.getSharedPreferences("counter_state", Context.MODE_PRIVATE)

    fun saveSelection(selection: CounterSelection) {
        prefs.edit()
            .putString("organizationId", selection.organizationId)
            .putString("organizationName", selection.organizationName)
            .putString("counterId", selection.counterId)
            .putString("environment", selection.environment.name)
            .apply()
    }

    fun loadSelection(): CounterSelection? {
        val organizationId = prefs.getString("organizationId", null) ?: return null
        val organizationName = prefs.getString("organizationName", null) ?: return null
        val counterId = prefs.getString("counterId", null) ?: return null
        val environment = prefs.getString("environment", null)?.let(CounterEnvironment::valueOf) ?: return null
        return CounterSelection(organizationId, organizationName, counterId, environment)
    }

    fun saveSnapshot(snapshot: CounterSnapshot) {
        prefs.edit().putInt("count", snapshot.count).apply()
    }

    fun loadSnapshot(selection: CounterSelection): CounterSnapshot? {
        if (!prefs.contains("count")) return null
        return CounterSnapshot(selection.organizationId, selection.organizationName, selection.counterId, prefs.getInt("count", 0))
    }

    fun clear() = prefs.edit().clear().apply()
}
