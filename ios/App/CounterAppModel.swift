import Foundation
import WidgetKit

@MainActor
final class CounterAppModel: ObservableObject {
    @Published private(set) var signedIn = false
    @Published private(set) var selections: [CounterSelection] = []
    @Published var selected: CounterSelection?
    @Published private(set) var snapshot: CounterSnapshot?
    @Published private(set) var busy = false
    @Published var errorMessage: String?

    private let authSession = CounterAuthenticationSession()
    private let sharedStore = CounterSharedStore()

    func restore() async {
        selected = sharedStore?.selection()
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
            await refresh()
        } catch {
            signedIn = false
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

            if available.count == 1 {
                try select(available[0])
                await refresh()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func select(_ selection: CounterSelection) throws {
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

    func signOut() {
        if let environment = selected?.environment {
            try? CounterRuntime.oauthClient(for: environment).signOut()
        } else {
            for environment in CounterEnvironment.allCases {
                try? CounterRuntime.oauthClient(for: environment).signOut()
            }
        }

        sharedStore?.clear()
        selections = []
        selected = nil
        snapshot = nil
        signedIn = false
        errorMessage = nil
        WidgetCenter.shared.reloadAllTimelines()
    }
}
