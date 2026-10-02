import SwiftUI

struct CounterRootView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass
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
                        .font(isWideLayout ? .title.bold() : .title2.bold())
                }

                if model.signedIn {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                if let url = URL(string: "https://console.mccarthysirishpub.com/settings/account") {
                                    openURL(url)
                                }
                            } label: {
                                Label("Settings", systemImage: "gearshape")
                            }

                            Divider()

                            Button(role: .destructive) {
                                Task {
                                    await model.signOut()
                                }
                            } label: {
                                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(.secondary.opacity(0.18))

                                Image(systemName: "person.fill")
                                    .font(.system(size: isWideLayout ? 18 : 15, weight: .semibold))
                                    .foregroundStyle(.primary)
                            }
                            .frame(width: isWideLayout ? 40 : 32, height: isWideLayout ? 40 : 32)
                            .contentShape(Circle())
                        }
                        .accessibilityLabel("Account menu")
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
        VStack(spacing: isWideLayout ? 22 : 16) {
            Spacer()

            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: isWideLayout ? 72 : 52))

            Text("Sign in to NiteOwl Counter")
                .font(isWideLayout ? .title.bold() : .title2.bold())

            Text("Use your NiteOwl account to load the counters assigned to you.")
                .font(isWideLayout ? .title3 : .body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Button("Sign in with NiteOwl.dev") {
                Task {
                    await model.signIn(environment: .niteOwl)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(isWideLayout ? .large : .regular)

            Button("Sign in with McCarthy’s") {
                Task {
                    await model.signIn(environment: .mccarthys)
                }
            }
            .buttonStyle(.bordered)
            .controlSize(isWideLayout ? .large : .regular)

            Spacer()
        }
        .padding(isWideLayout ? 32 : 16)
        .frame(maxWidth: isWideLayout ? 680 : 560)
        .frame(maxWidth: .infinity)
    }

    private var signedInView: some View {
        List {
            if model.organizations.count > 1 {
                Menu {
                    ForEach(model.organizations, id: \.organizationID) { organization in
                        Button {
                            selectOrganization(organization.organizationID)
                        } label: {
                            if organization.organizationID == model.selectedOrganizationID {
                                Label(organization.organizationName, systemImage: "checkmark")
                            } else {
                                Text(organization.organizationName)
                            }
                        }
                    }
                } label: {
                    selectorLabel(selectedOrganizationName)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowInsets(selectorInsets)
                .accessibilityLabel("Organization")
            }

            if let organizationID = model.selectedOrganizationID {
                let counters = model.counters(for: organizationID)

                if counters.count > 1 {
                    Menu {
                        ForEach(counters, id: \.counterID) { counter in
                            Button {
                                selectCounter(counter)
                            } label: {
                                if counter.counterID == model.selected?.counterID {
                                    Label(counter.counterDisplayName, systemImage: "checkmark")
                                } else {
                                    Text(counter.counterDisplayName)
                                }
                            }
                        }
                    } label: {
                        selectorLabel(model.selected?.counterDisplayName ?? "Select a counter")
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Color.clear)
                    .listRowInsets(selectorInsets)
                    .accessibilityLabel("Counter")
                }
            }

            if model.selected != nil {
                Section {
                    HStack {
                        Spacer()
                        Text(model.snapshot.map { String($0.count) } ?? "—")
                            .font(.system(size: countFontSize, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Spacer()
                    }
                    .padding(.vertical, countVerticalPadding)

                    HStack(spacing: isWideLayout ? 18 : 12) {
                        Button {
                            Task {
                                await model.send(.decrement)
                            }
                        } label: {
                            Text("−1")
                                .font(.system(size: controlFontSize, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.black)
                                .frame(maxWidth: .infinity, minHeight: controlHeight)
                                .background(Color(red: 245 / 255, green: 206 / 255, blue: 69 / 255))
                                .clipShape(RoundedRectangle(cornerRadius: isWideLayout ? 22 : 18, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        Button {
                            Task {
                                await model.send(.increment)
                            }
                        } label: {
                            Text("+1")
                                .font(.system(size: controlFontSize, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity, minHeight: controlHeight)
                                .background(Color(red: 80 / 255, green: 117 / 255, blue: 187 / 255))
                                .clipShape(RoundedRectangle(cornerRadius: isWideLayout ? 22 : 18, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .disabled(model.busy)

                    Text(resetPressed ? "Keep Holding…" : "Reset")
                        .font(isWideLayout ? .title3.bold() : .headline)
                        .foregroundStyle(Color(red: 1.0, green: 0.38, blue: 0.38))
                        .frame(maxWidth: .infinity, minHeight: resetHeight)
                        .background(
                            resetPressed
                                ? Color(red: 0.25, green: 0.10, blue: 0.11)
                                : Color(red: 0.34, green: 0.16, blue: 0.17)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: isWideLayout ? 16 : 12, style: .continuous))
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

                    Button {
                        Task {
                            await model.refresh()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(isWideLayout ? .title2 : .body)
                    }
                    .accessibilityLabel("Refresh")
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
        .frame(maxWidth: isWideLayout ? 860 : 640)
        .frame(maxWidth: .infinity)
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

    private var isWideLayout: Bool {
        horizontalSizeClass == .regular
    }

    private var isWideLandscape: Bool {
        isWideLayout && verticalSizeClass == .compact
    }

    private var countFontSize: CGFloat {
        if isWideLandscape { return 88 }
        return isWideLayout ? 108 : 72
    }

    private var countVerticalPadding: CGFloat {
        if isWideLandscape { return 12 }
        return isWideLayout ? 28 : 16
    }

    private var controlFontSize: CGFloat {
        if isWideLandscape { return 40 }
        return isWideLayout ? 46 : 34
    }

    private var controlHeight: CGFloat {
        if isWideLandscape { return 84 }
        return isWideLayout ? 104 : 76
    }

    private var resetHeight: CGFloat {
        if isWideLandscape { return 56 }
        return isWideLayout ? 68 : 50
    }

    private var selectorInsets: EdgeInsets {
        EdgeInsets(
            top: isWideLandscape ? 6 : (isWideLayout ? 10 : 6),
            leading: isWideLayout ? 28 : 20,
            bottom: isWideLandscape ? 6 : (isWideLayout ? 10 : 6),
            trailing: isWideLayout ? 28 : 20
        )
    }

    private func selectOrganization(_ organizationID: String) {
        Task { @MainActor in
            await Task.yield()
            do {
                try model.selectOrganization(organizationID)
                if model.selected != nil {
                    await model.refresh()
                }
            } catch {
                model.errorMessage = error.localizedDescription
            }
        }
    }

    private func selectCounter(_ counter: CounterSelection) {
        Task { @MainActor in
            await Task.yield()
            do {
                try model.select(counter)
                await model.refresh()
            } catch {
                model.errorMessage = error.localizedDescription
            }
        }
    }

    private func selectorLabel(_ title: String) -> some View {
        Text(title)
            .font(isWideLayout ? .title3.weight(.semibold) : .body.weight(.semibold))
            .foregroundStyle(.primary)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, minHeight: isWideLandscape ? 54 : (isWideLayout ? 64 : 50))
            .padding(.horizontal, isWideLayout ? 22 : 16)
            .overlay {
                RoundedRectangle(cornerRadius: isWideLayout ? 20 : 16, style: .continuous)
                    .stroke(.secondary.opacity(0.55), lineWidth: 1)
            }
            .contentShape(RoundedRectangle(cornerRadius: isWideLayout ? 20 : 16, style: .continuous))
    }

    private var selectedOrganizationName: String {
        guard let organizationID = model.selectedOrganizationID else {
            return "Select an organization"
        }

        return model.organizations.first(where: {
            $0.organizationID == organizationID
        })?.organizationName ?? "Select an organization"
    }
}
