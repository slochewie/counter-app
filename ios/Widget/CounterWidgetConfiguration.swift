import AppIntents

struct CounterWidgetConfigurationIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Counter"
    static let description = IntentDescription("Choose the Counter this widget displays.")

    @Parameter(title: "Counter")
    var counter: CounterWidgetEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$counter)")
    }

    init() {}

    init(counter: CounterWidgetEntity?) {
        self.counter = counter
    }
}

struct CounterWidgetEntity: AppEntity, Identifiable, Hashable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Counter")
    static let defaultQuery = CounterWidgetEntityQuery()

    let id: String
    let organizationID: String
    let organizationName: String
    let counterID: String
    let environment: CounterEnvironment

    init(selection: CounterSelection) {
        id = Self.id(for: selection)
        organizationID = selection.organizationID
        organizationName = selection.organizationName
        counterID = selection.counterID
        environment = selection.environment
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(organizationName)",
            subtitle: "\(counterID)"
        )
    }

    var selection: CounterSelection {
        CounterSelection(
            organizationID: organizationID,
            organizationName: organizationName,
            counterID: counterID,
            environment: environment
        )
    }

    private static func id(for selection: CounterSelection) -> String {
        [
            selection.environment.rawValue,
            selection.organizationID,
            selection.counterID,
        ].joined(separator: ":")
    }
}

struct CounterWidgetEntityQuery: EntityQuery {
    func entities(for identifiers: [CounterWidgetEntity.ID]) async throws -> [CounterWidgetEntity] {
        let requested = Set(identifiers)
        return availableEntities().filter { requested.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CounterWidgetEntity] {
        availableEntities()
    }

    func defaultResult() async -> CounterWidgetEntity? {
        guard let selection = CounterSharedStore()?.selection() else {
            return nil
        }
        return CounterWidgetEntity(selection: selection)
    }

    private func availableEntities() -> [CounterWidgetEntity] {
        (CounterSharedStore()?.selections() ?? [])
            .map(CounterWidgetEntity.init(selection:))
    }
}
