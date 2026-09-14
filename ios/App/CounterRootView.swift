import SwiftUI

struct CounterRootView: View {
    @ObservedObject var model: CounterAppModel
    @GestureState private var resetPressed = false

    var body: some View {
        NavigationStack {
            Group {
                if model.signedIn {
                    signedInView
                } else {
                    signInView
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Capacity Counter")
                        .font(.title2.bold())
                }

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
                Section {
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

                    HStack(spacing: 12) {
                        Button {
                            Task {
                                await model.send(.decrement)
                            }
                        } label: {
                            Text("−1")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.black)
                                .frame(maxWidth: .infinity, minHeight: 76)
                                .background(Color(red: 245 / 255, green: 206 / 255, blue: 69 / 255))
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        Button {
                            Task {
                                await model.send(.increment)
                            }
                        } label: {
                            Text("+1")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity, minHeight: 76)
                                .background(Color(red: 80 / 255, green: 117 / 255, blue: 187 / 255))
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .disabled(model.busy)

                    Text(resetPressed ? "Keep Holding…" : "Hold Reset")
                        .font(.headline)
                        .foregroundStyle(Color(red: 1.0, green: 0.38, blue: 0.38))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(
                            resetPressed
                                ? Color(red: 0.25, green: 0.10, blue: 0.11)
                                : Color(red: 0.34, green: 0.16, blue: 0.17)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .contentShape(Rectangle())
                        .opacity(model.busy ? 0.45 : 1)
                        .gesture(
                            LongPressGesture(minimumDuration: 0.8)
                                .updating($resetPressed) { current, state, _ in
                                    state = current
                                }
                                .onEnded { _ in
                                    guard !model.busy else {
                                        return
                                    }

                                    Task {
                                        await model.send(.reset)
                                    }
                                }
                        )
                        .accessibilityLabel("Hold to reset Counter")

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
        .task(id: model.selected) {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                guard !Task.isCancelled else {
                    return
                }
                await model.refreshSilently()
            }
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
