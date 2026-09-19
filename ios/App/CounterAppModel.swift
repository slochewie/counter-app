import Foundation
import SwiftUI
import WidgetKit

@MainActor
final class CounterAppModel: ObservableObject {
    @Published private(set) var signedIn = false
    @Published private(set) var selections: [CounterSelection] = []
    @Published var selected: CounterSelection?
    @Published var selectedOrganizationID: String?
    @Published private(set) var snapshot: CounterSnapshot?
    @Published private(set) var busy = false
    @Published var errorMessage: String?

    private let authSession = CounterAuthenticationSession()
    private let sharedStore = CounterSharedStore()

    func restore() async {
        selected = sharedStore?.selection()
        selectedOrganizationID = selected?.organizationID
        snapshot = sharedStore?.snapshot()

        guard let selection = selected else {
            return
        }

        let oauth = CounterRuntime.oauthClient(for: selection.environment)
        do {
            _ = try await oauth.validAccessToken()
            signedIn = true
            selections = try await CounterRuntime
                .apiClient(for: selection.environment)
                .availableCounters(in: selection.environment)

            if let refreshedSelection = selections.first(where: {
                $0.organizationID == selection.organizationID && $0.counterID == selection.counterID
            }) {
                try select(refreshedSelection)
            }
            await refresh()
        } catch {
            signedIn = false
        }
    }

    func open(_ url: URL) async {
        guard url.scheme == "dev.niteowl.counter",
              url.path == "/counter",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let environmentValue = components.queryItems?.first(where: { $0.name == "environment" })?.value,
              let organizationID = components.queryItems?.first(where: { $0.name == "organizationId" })?.value,
              let counterID = components.queryItems?.first(where: { $0.name == "counterId" })?.value,
              let environment = CounterEnvironment(rawValue: environmentValue)
        else {
            return
        }

        do {
            _ = try await CounterRuntime.oauthClient(for: environment).validAccessToken()
            signedIn = true

            let available = try await CounterRuntime
                .apiClient(for: environment)
                .availableCounters(in: environment)
            selections = available

            guard let selection = available.first(where: {
                $0.organizationID == organizationID && $0.counterID == counterID
            }) else {
                errorMessage = "This Counter is no longer available to your account."
                return
            }

            try select(selection)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signIn(environment: CounterEnvironment) async {
        busy = true
        errorMessage = nil
        defer { busy = false }

        let oauth = CounterRuntime.oauthClient(for: environment)

        do {
            _ = try await authSession.signIn(using: oauth)
            signedIn = true
            let available = try await CounterRuntime
                .apiClient(for: environment)
                .availableCounters(in: environment)
            selections = available

            let organizationIDs = Set(available.map(\.organizationID))
            if organizationIDs.count == 1, let organizationID = organizationIDs.first {
                try selectOrganization(organizationID)
            }

            if available.count == 1 {
                await refresh()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var organizations: [CounterSelection] {
        var seen = Set<String>()
        return selections.filter { seen.insert($0.organizationID).inserted }
    }

    func counters(for organizationID: String) -> [CounterSelection] {
        selections.filter { $0.organizationID == organizationID }
    }

    func selectOrganization(_ organizationID: String) throws {
        selectedOrganizationID = organizationID
        let counters = counters(for: organizationID)

        if counters.count == 1, let counter = counters.first {
            try select(counter)
            return
        }

        if let selected, selected.organizationID == organizationID {
            return
        }

        selected = nil
        snapshot = nil
    }

    func select(_ selection: CounterSelection) throws {
        selectedOrganizationID = selection.organizationID
        selected = selection
        try sharedStore?.saveSelection(selection)
        WidgetCenter.shared.reloadAllTimelines()
    }

    func refresh() async {
        guard let selection = selected else {
            return
        }

        busy = true
        errorMessage = nil
        defer { busy = false }

        do {
            let value = try await CounterRuntime
                .apiClient(for: selection.environment)
                .state(for: selection)
            snapshot = value
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshSilently() async {
        guard !busy, let selection = selected else {
            return
        }

        do {
            let value = try await CounterRuntime
                .apiClient(for: selection.environment)
                .state(for: selection)
            snapshot = value
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            // Automatic foreground refreshes should not interrupt the user.
        }
    }

    func send(_ command: CounterCommand) async {
        guard let selection = selected else {
            return
        }

        busy = true
        errorMessage = nil
        defer { busy = false }

        do {
            let value = try await CounterRuntime
                .apiClient(for: selection.environment)
                .send(command, for: selection)
            snapshot = value
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        if let environment = selected?.environment {
            try? await CounterRuntime.oauthClient(for: environment).signOut()
        } else {
            for environment in CounterEnvironment.allCases {
                try? await CounterRuntime.oauthClient(for: environment).signOut()
            }
        }

        sharedStore?.clear()
        selections = []
        selected = nil
        selectedOrganizationID = nil
        snapshot = nil
        signedIn = false
        errorMessage = nil
        WidgetCenter.shared.reloadAllTimelines()
    }
}
