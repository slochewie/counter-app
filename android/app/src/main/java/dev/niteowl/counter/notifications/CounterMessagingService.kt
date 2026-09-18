package dev.niteowl.counter.notifications

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dev.niteowl.counter.data.CounterSnapshot
import dev.niteowl.counter.data.CounterStore
import dev.niteowl.counter.widget.updateCounterWidgets

class CounterMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("NiteOwlCounter", "FCM registration token refreshed: $token")
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val count = data["count"]?.toIntOrNull()
        if (count == null) {
            Log.d("NiteOwlCounter", "FCM message received without counter state")
            return
        }

        val store = CounterStore(applicationContext)
        val selection = store.loadSelection()
        if (selection == null) {
            Log.d("NiteOwlCounter", "FCM counter state ignored because no counter is selected")
            return
        }

        val organizationId = data["organizationId"]
        val counterId = data["counterId"]
        if ((organizationId != null && organizationId != selection.organizationId) ||
            (counterId != null && counterId != selection.counterId)
        ) {
            Log.d("NiteOwlCounter", "FCM counter state ignored for a different selected counter")
            return
        }

        val snapshot = CounterSnapshot(
            organizationId = selection.organizationId,
            organizationName = selection.organizationName,
            counterId = selection.counterId,
            count = count,
        )
        store.saveSnapshot(snapshot)
        CoroutineScope(Dispatchers.IO).launch {
            updateCounterWidgets(applicationContext, selection.organizationName, count)
        }
        Log.d("NiteOwlCounter", "FCM counter state applied: count=$count")
    }
}
