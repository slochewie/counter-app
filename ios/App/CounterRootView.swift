import SwiftUI

struct CounterRootView: View {
    @ObservedObject var model: CounterAppModel

    var body: some View {
        NavigationStack {
            Group {
                if model.signedIn {
                    signedInView
                } else {
                    signInView
                }
            }
            .navigationTitle("Counter")
            .toolbar {
                if model.signedIn {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Sign Out") {
                            Task {
                                await model.signOut()
                            }
                        }
                    }
                }
            }
            .overlay {
                if model.busy {
                    ProgressView()
                }
            }
            .alert(
                "Counter Error",
                isPresented: Binding(
                    get: { model.errorMessage != nil },
                    set: { if !$0 { model.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {
                    model.errorMessage = nil
                }
            } message: {
                Text(model.errorMessage ?? "Unknown error")
            }
        }
    }

    private var signInView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 52))

            Text("Sign in to NiteOwl Counter")
                .font(.title2.bold())

            Text("Use your NiteOwl account to load the counters assigned to you.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Button("Sign in with NiteOwl.dev") {
                Task {
                    await model.signIn(environment: .niteOwl)
                }
            }
            .buttonStyle(.borderedProminent)

            Button("Sign in with McCarthy’s") {
                Task {
                    await model.signIn(environment: .mccarthys)
                }
            }
            .buttonStyle(.bordered)

            Spacer()
        }
        .padding()
    }

    private var signedInView: some View {
        List {
            if model.selections.count > 1 {
                Section("Counter") {
                    Picker("Counter", selection: selectedBinding) {
                        Text("Select a counter")
                            .tag(Optional<CounterSelection>.none)

                        ForEach(model.selections, id: \.counterID) { selection in
                            Text(selection.organizationName)
                                .tag(Optional(selection))
                        }
                    }
                }
            }

            if let selection = model.selected {
                Section(selection.organizationName) {
                    HStack {
                        Spacer()
                        Text(model.snapshot.map { String($0.count) } ?? "—")
                            .font(.system(size: 72, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Spacer()
                    }
                    .padding(.vertical, 16)

                    HStack(spacing: 20) {
                        Button {
                            Task {
                                await model.send(.decrement)
                            }
                        } label: {
                            Label("Decrease", systemImage: "minus")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)

                        Button {
                            Task {
                                await model.send(.increment)
                            }
                        } label: {
                            Label("Increase", systemImage: "plus")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .disabled(model.busy)

                    Button("Refresh") {
                        Task {
                            await model.refresh()
                        }
                    }
                    .disabled(model.busy)
                }
            } else if model.selections.isEmpty {
                ContentUnavailableView(
                    "No Counters",
                    systemImage: "number",
                    description: Text("No active Counter assignments were returned for this account.")
                )
            } else {
                ContentUnavailableView(
                    "Select a Counter",
                    systemImage: "number",
                    description: Text("Choose one of your assigned counters above.")
                )
            }
        }
        .refreshable {
            await model.refresh()
        }
    }

    private var selectedBinding: Binding<CounterSelection?> {
        Binding(
            get: { model.selected },
            set: { selection in
                guard let selection else {
                    return
                }

                do {
                    try model.select(selection)
                    Task {
                        await model.refresh()
                    }
                } catch {
                    model.errorMessage = error.localizedDescription
                }
            }
        )
    }
}
