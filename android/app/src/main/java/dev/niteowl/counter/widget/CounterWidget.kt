package dev.niteowl.counter.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.niteowl.counter.MainActivity
import dev.niteowl.counter.api.CounterApiClient
import dev.niteowl.counter.auth.OAuthClient
import dev.niteowl.counter.auth.TokenStore
import dev.niteowl.counter.data.CounterCommand
import dev.niteowl.counter.data.CounterStore

class CounterWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val store = CounterStore(context)
        val selection = store.loadSelection()
        val snapshot = selection?.let(store::loadSnapshot)

        provideContent {
            CounterWidgetContent(
                organizationName = selection?.organizationName ?: "NiteOwl Counter",
                count = snapshot?.count,
            )
        }
    }
}

class CounterWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CounterWidget()
}

@Composable
private fun CounterWidgetContent(organizationName: String, count: Int?) {
    val size = LocalSize.current
    val medium = size.width >= 220.dp
    val openApp = actionStartActivity<MainActivity>()

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(Color(0xFF111116)))
            .padding(16.dp)
            .clickable(openApp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
        horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
    ) {
        Text(
            text = organizationName,
            modifier = GlanceModifier.fillMaxWidth(),
            style = TextStyle(
                color = ColorProvider(Color(0xFFF5F5F7)),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
            ),
            maxLines = 1,
        )
        Spacer(GlanceModifier.height(8.dp))
        Text(
            text = count?.toString() ?: "—",
            modifier = GlanceModifier.fillMaxWidth(),
            style = TextStyle(
                color = ColorProvider(Color.White),
                fontSize = if (medium) 48.sp else 42.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            ),
        )

        if (medium && count != null) {
            Spacer(GlanceModifier.height(10.dp))
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
                verticalAlignment = Alignment.Vertical.CenterVertically,
            ) {
                WidgetButton(
                    label = "−1",
                    background = Color(0xFFF5CE45),
                    foreground = Color.Black,
                    command = CounterCommand.DECREMENT,
                )
                Spacer(GlanceModifier.size(12.dp))
                WidgetButton(
                    label = "+1",
                    background = Color(0xFF5075BB),
                    foreground = Color.White,
                    command = CounterCommand.INCREMENT,
                )
            }
        }
    }
}

@Composable
private fun WidgetButton(label: String, background: Color, foreground: Color, command: CounterCommand) {
    Text(
        text = label,
        modifier = GlanceModifier
            .size(width = 76.dp, height = 42.dp)
            .background(ColorProvider(background))
            .clickable(
                actionRunCallback<CounterCommandAction>(
                    actionParametersOf(CommandKey to command.wireValue),
                ),
            )
            .padding(vertical = 8.dp),
        style = TextStyle(
            color = ColorProvider(foreground),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        ),
    )
}

private val CommandKey = ActionParameters.Key<String>("command")

class CounterCommandAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val command = when (parameters[CommandKey]) {
            CounterCommand.INCREMENT.wireValue -> CounterCommand.INCREMENT
            CounterCommand.DECREMENT.wireValue -> CounterCommand.DECREMENT
            else -> return
        }
        val store = CounterStore(context)
        val selection = store.loadSelection() ?: return
        val oauth = OAuthClient(TokenStore(context))
        val api = CounterApiClient(oauth)

        runCatching {
            val snapshot = api.send(selection, command)
            store.saveSnapshot(snapshot)
            CounterWidget().update(context, glanceId)
        }
    }
}
