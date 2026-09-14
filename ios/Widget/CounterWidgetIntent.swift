import AppIntents
import WidgetKit

struct IncrementCounterIntent: AppIntent {
    static let title: LocalizedStringResource = "Increment Counter"
    static let description = IntentDescription("Adds one to the selected Counter.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        try await performCounterCommand(.increment)
        return .result()
    }
}

struct DecrementCounterIntent: AppIntent {
    static let title: LocalizedStringResource = "Decrement Counter"
    static let description = IntentDescription("Subtracts one from the selected Counter.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        try await performCounterCommand(.decrement)
        return .result()
    }
}

private func performCounterCommand(_ command: CounterCommand) async throws {
    guard let store = CounterSharedStore(), let selection = store.selection() else {
        throw CounterWidgetIntentError.noSelection
    }

    let api = CounterRuntime.apiClient(for: selection.environment)
    _ = try await api.send(command, for: selection)
    WidgetCenter.shared.reloadTimelines(ofKind: CounterWidget.kind)
}

enum CounterWidgetIntentError: Error, LocalizedError {
    case noSelection

    var errorDescription: String? {
        switch self {
        case .noSelection:
            return "Open NiteOwl Counter and select a Counter first."
        }
    }
}
