package dev.niteowl.counter.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import dev.niteowl.counter.data.CounterCommand
import dev.niteowl.counter.data.CounterEnvironment
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CounterApp(viewModel: CounterViewModel) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var accountMenuOpen by remember { mutableStateOf(false) }
    var organizationMenuOpen by remember { mutableStateOf(false) }
    var counterMenuOpen by remember { mutableStateOf(false) }
    var resetting by remember { mutableStateOf(false) }

    MaterialTheme(colorScheme = androidx.compose.material3.darkColorScheme()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Capacity Counter", fontWeight = FontWeight.Bold) },
                    actions = {
                        if (state.signedIn) {
                            Box {
                                TextButton(onClick = { accountMenuOpen = true }) {
                                    androidx.compose.material3.Icon(Icons.Default.AccountCircle, contentDescription = "Account menu", modifier = Modifier.size(30.dp))
                                }
                                DropdownMenu(expanded = accountMenuOpen, onDismissRequest = { accountMenuOpen = false }) {
                                    DropdownMenuItem(
                                        text = { Text("Settings") },
                                        onClick = {
                                            accountMenuOpen = false
                                            context.startActivity(Intent(Intent.ACTION_VIEW, "https://console.mccarthysirishpub.com/settings/account".toUri()))
                                        },
                                    )
                                    HorizontalDivider()
                                    DropdownMenuItem(
                                        text = { Text("Sign Out", color = MaterialTheme.colorScheme.error) },
                                        onClick = {
                                            accountMenuOpen = false
                                            viewModel.signOut()
                                        },
                                    )
                                }
                            }
                        }
                    },
                )
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                if (!state.signedIn) {
                    SignInScreen(
                        onNiteOwl = {
                            val uri = viewModel.authorizationUri(CounterEnvironment.NITEOWL)
                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                        },
                        onMcCarthys = {
                            val uri = viewModel.authorizationUri(CounterEnvironment.MCCARTHYS)
                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                        },
                    )
                } else {
                    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        val organizations = state.selections.distinctBy { it.organizationId }
                        if (organizations.size > 1) {
                            Box {
                                OutlinedButton(onClick = { organizationMenuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text(
                                        organizations.firstOrNull { it.organizationId == state.selectedOrganizationId }?.organizationName
                                            ?: "Select an organization",
                                    )
                                }
                                DropdownMenu(expanded = organizationMenuOpen, onDismissRequest = { organizationMenuOpen = false }) {
                                    organizations.forEach { organization ->
                                        DropdownMenuItem(
                                            text = { Text(organization.organizationName) },
                                            onClick = {
                                                organizationMenuOpen = false
                                                viewModel.selectOrganization(organization.organizationId)
                                            },
                                        )
                                    }
                                }
                            }
                        }

                        val organizationId = state.selectedOrganizationId
                        val counters = if (organizationId == null) emptyList() else {
                            state.selections.filter { it.organizationId == organizationId }
                        }
                        if (counters.size > 1) {
                            Box {
                                OutlinedButton(onClick = { counterMenuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                                    Text(state.selected?.counterDisplayName ?: "Select a counter")
                                }
                                DropdownMenu(expanded = counterMenuOpen, onDismissRequest = { counterMenuOpen = false }) {
                                    counters.forEach { counter ->
                                        DropdownMenuItem(
                                            text = { Text(counter.counterDisplayName) },
                                            onClick = {
                                                counterMenuOpen = false
                                                viewModel.select(counter)
                                            },
                                        )
                                    }
                                }
                            }
                        }

                        val selection = state.selected
                        if (selection == null) {
                            EmptyState(if (state.selections.isEmpty()) "No Counters" else "Select a Counter")
                        } else {
                            Text(
                                state.snapshot?.count?.toString() ?: "—",
                                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                                textAlign = TextAlign.Center,
                                fontSize = 72.sp,
                                fontWeight = FontWeight.SemiBold,
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                                Button(
                                    onClick = { viewModel.send(CounterCommand.DECREMENT) },
                                    enabled = !state.busy,
                                    modifier = Modifier.weight(1f).height(76.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF5CE45), contentColor = Color.Black),
                                    shape = RoundedCornerShape(18.dp),
                                ) { Text("−1", fontSize = 34.sp, fontWeight = FontWeight.Bold) }

                                Button(
                                    onClick = { viewModel.send(CounterCommand.INCREMENT) },
                                    enabled = !state.busy,
                                    modifier = Modifier.weight(1f).height(76.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF5075BB), contentColor = Color.White),
                                    shape = RoundedCornerShape(18.dp),
                                ) { Text("+1", fontSize = 34.sp, fontWeight = FontWeight.Bold) }
                            }

                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .pointerInput(state.busy) {
                                        detectTapGestures(
                                            onPress = {
                                                if (state.busy) return@detectTapGestures
                                                resetting = true
                                                val held = try {
                                                    delay(800)
                                                    true
                                                } finally {
                                                    resetting = false
                                                }
                                                if (held) viewModel.send(CounterCommand.RESET)
                                            },
                                        )
                                    },
                                color = if (resetting) Color(0xFF401A1C) else Color(0xFF57292B),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        if (resetting) "Keep Holding…" else "Reset",
                                        color = Color(0xFFFF6161),
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                            }

                            TextButton(onClick = viewModel::refresh, enabled = !state.busy, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                                androidx.compose.material3.Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                            }
                        }
                    }
                }

                if (state.busy) {
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
                }
            }
        }

        state.error?.let { message ->
            AlertDialog(
                onDismissRequest = viewModel::clearError,
                confirmButton = { TextButton(onClick = viewModel::clearError) { Text("OK") } },
                title = { Text("Counter Error") },
                text = { Text(message) },
            )
        }
    }
}

@Composable
private fun SignInScreen(onNiteOwl: () -> Unit, onMcCarthys: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        androidx.compose.material3.Icon(Icons.Default.AccountCircle, contentDescription = null, modifier = Modifier.size(52.dp))
        Spacer(Modifier.height(16.dp))
        Text("Sign in to NiteOwl Counter", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Use your NiteOwl account to load the counters assigned to you.", textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(18.dp))
        Button(onClick = onNiteOwl) { Text("Sign in with NiteOwl.dev") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onMcCarthys) { Text("Sign in with McCarthy’s") }
    }
}

@Composable
private fun EmptyState(title: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
    }
}
