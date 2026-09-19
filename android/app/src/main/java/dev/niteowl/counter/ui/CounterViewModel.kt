package dev.niteowl.counter.ui

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.net.toUri
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.niteowl.counter.api.CounterApiClient
import dev.niteowl.counter.auth.OAuthClient
import dev.niteowl.counter.auth.OAuthConfig
import dev.niteowl.counter.auth.TokenStore
import dev.niteowl.counter.data.CounterCommand
import dev.niteowl.counter.data.CounterEnvironment
import dev.niteowl.counter.data.CounterSelection
import dev.niteowl.counter.data.CounterSnapshot
import dev.niteowl.counter.data.CounterStore
import dev.niteowl.counter.widget.CounterWidget
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CounterViewModel : ViewModel() {
    data class UiState(
        val signedIn: Boolean = false,
        val selections: List<CounterSelection> = emptyList(),
        val selected: CounterSelection? = null,
        val selectedOrganizationId: String? = null,
        val snapshot: CounterSnapshot? = null,
        val busy: Boolean = false,
        val error: String? = null,
    )

    private val mutableState = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = mutableState.asStateFlow()

    private var oauth: OAuthClient? = null
    private var api: CounterApiClient? = null
    private var store: CounterStore? = null
    private var appContext: Context? = null
    private var pendingEnvironment: CounterEnvironment? = null
    private var pollingJob: Job? = null

    fun initialize(context: Context) {
        if (oauth != null) return
        appContext = context.applicationContext
        store = CounterStore(context.applicationContext)
        oauth = OAuthClient(TokenStore(context.applicationContext))
        api = CounterApiClient(requireNotNull(oauth))

        val selected = store?.loadSelection()
        mutableState.value = mutableState.value.copy(
            selected = selected,
            selectedOrganizationId = selected?.organizationId,
            snapshot = selected?.let { store?.loadSnapshot(it) },
        )
        if (selected != null) restore(selected.environment)
    }

    fun authorizationUri(environment: CounterEnvironment) = requireNotNull(oauth).authorizationUri(environment).also {
        pendingEnvironment = environment
    }

    fun handleIntent(intent: Intent?) {
        val callback = intent?.data ?: return
        if (callback.scheme != OAuthConfig.CALLBACK_SCHEME) return
        val environment = pendingEnvironment ?: mutableState.value.selected?.environment ?: CounterEnvironment.NITEOWL
        launchBusy {
            requireNotNull(oauth).exchangeCallback(environment, callback)
            loadAssignments(environment)
        }
    }

    private fun restore(environment: CounterEnvironment) {
        launchBusy(showErrors = false) {
            requireNotNull(oauth).validAccessToken(environment)
            loadAssignments(environment)
        }
    }

    private suspend fun loadAssignments(environment: CounterEnvironment) {
        val selections = withContext(Dispatchers.IO) { requireNotNull(api).availableCounters(environment) }
        val previous = mutableState.value.selected
        val selected = when {
            previous != null -> selections.firstOrNull {
                it.organizationId == previous.organizationId && it.counterId == previous.counterId
            }
            selections.size == 1 -> selections.first()
            selections.map { it.organizationId }.distinct().size == 1 -> selections.firstOrNull()
            else -> null
        }
        if (selected != null) store?.saveSelection(selected)
        mutableState.value = mutableState.value.copy(
            signedIn = true,
            selections = selections,
            selected = selected,
            selectedOrganizationId = selected?.organizationId,
        )
        if (selected != null) {
            refreshInternal(silent = true)
            registerFcmToken(selected)
        }
        startPolling()
    }

    fun organizations(): List<CounterSelection> =
        mutableState.value.selections.distinctBy { it.organizationId }

    fun countersFor(organizationId: String): List<CounterSelection> =
        mutableState.value.selections.filter { it.organizationId == organizationId }

    fun selectOrganization(organizationId: String) {
        val counters = countersFor(organizationId)
        val current = mutableState.value.selected
        val selection = if (current?.organizationId == organizationId &&
            counters.any { it.counterId == current.counterId }
        ) current else counters.firstOrNull()

        mutableState.value = mutableState.value.copy(
            selectedOrganizationId = organizationId,
            selected = selection,
            snapshot = selection?.let { store?.loadSnapshot(it) },
        )
        if (selection != null) {
            store?.saveSelection(selection)
            refresh()
            viewModelScope.launch { registerFcmToken(selection) }
        }
    }

    fun select(selection: CounterSelection) {
        store?.saveSelection(selection)
        mutableState.value = mutableState.value.copy(
            selected = selection,
            selectedOrganizationId = selection.organizationId,
            snapshot = store?.loadSnapshot(selection),
        )
        refresh()
        viewModelScope.launch { registerFcmToken(selection) }
    }

    private suspend fun registerFcmToken(selection: CounterSelection) {
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            requireNotNull(api).registerFcmToken(selection, token)
            Log.d("NiteOwlCounter", "FCM registration synced for counter: ${selection.counterId}")
        } catch (error: Throwable) {
            Log.e("NiteOwlCounter", "Unable to sync FCM registration", error)
        }
    }

    fun refresh() = launchBusy { refreshInternal(silent = false) }

    private suspend fun refreshInternal(silent: Boolean) {
        val selection = mutableState.value.selected ?: return
        try {
            val snapshot = withContext(Dispatchers.IO) { requireNotNull(api).state(selection) }
            saveSnapshot(snapshot)
        } catch (error: Throwable) {
            if (!silent) throw error
        }
    }

    fun send(command: CounterCommand) = launchBusy {
        val selection = mutableState.value.selected ?: return@launchBusy
        val snapshot = withContext(Dispatchers.IO) { requireNotNull(api).send(selection, command) }
        saveSnapshot(snapshot)
    }

    private suspend fun saveSnapshot(snapshot: CounterSnapshot) {
        store?.saveSnapshot(snapshot)
        mutableState.value = mutableState.value.copy(snapshot = snapshot)
        appContext?.let { CounterWidget().updateAll(it) }
    }

    fun signOut() {
        pollingJob?.cancel()
        oauth?.clear()
        store?.clear()
        mutableState.value = UiState()
        appContext?.let { context ->
            viewModelScope.launch { CounterWidget().updateAll(context) }
        }
    }

    fun clearError() {
        mutableState.value = mutableState.value.copy(error = null)
    }

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(2_000)
                if (!mutableState.value.busy) refreshInternal(silent = true)
            }
        }
    }

    private fun launchBusy(showErrors: Boolean = true, block: suspend () -> Unit) {
        viewModelScope.launch {
            mutableState.value = mutableState.value.copy(busy = true, error = null)
            try {
                block()
            } catch (error: Throwable) {
                Log.e("NiteOwlCounter", "Counter operation failed", error)
                mutableState.value = mutableState.value.copy(
                    signedIn = if (showErrors) mutableState.value.signedIn else false,
                    error = if (showErrors) error.message ?: "${error::class.java.simpleName}: ${error}" else null,
                )
            } finally {
                mutableState.value = mutableState.value.copy(busy = false)
            }
        }
    }
}
