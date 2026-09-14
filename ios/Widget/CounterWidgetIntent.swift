import AppIntents
import WidgetKit

struct IncrementCounterIntent: AppIntent {
    static let title: LocalizedStringResource = "Increment Counter"
    static let description = IntentDescription("Adds one to the configured Counter.")
    static let openAppWhenRun = false

    @Parameter(title: "Counter")
    var counter: CounterWidgetEntity?

    init() {}

    init(counter: CounterWidgetEntity?) {
        self.counter = counter
    }

    func perform() async throws -> some IntentResult {
        try await performCounterCommand(.increment, counter: counter)
        return .result()
    }
}

struct DecrementCounterIntent: AppIntent {
    static let title: LocalizedStringResource = "Decrement Counter"
    static let description = IntentDescription("Subtracts one from the configured Counter.")
    static let openAppWhenRun = false

    @Parameter(title: "Counter")
    var counter: CounterWidgetEntity?

    init() {}

    init(counter: CounterWidgetEntity?) {
        self.counter = counter
    }

    func perform() async throws -> some IntentResult {
        try await performCounterCommand(.decrement, counter: counter)
        return .result()
    }
}

private func performCounterCommand(
    _ command: CounterCommand,
    counter: CounterWidgetEntity?
) async throws {
    let selection = counter?.selection ?? CounterSharedStore()?.selection()
    guard let selection else {
        throw CounterWidgetIntentError.noSelection
    }

    let api = CounterRuntime.apiClient(for: selection.environment)
    _ = try await api.send(command, for: selection)
    WidgetCenter.shared.reloadTimelines(ofKind: counterWidgetKind)
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
