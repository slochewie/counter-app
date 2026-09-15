import AppIntents
import SwiftUI
import WidgetKit

let counterWidgetKind = "CounterWidget"
let counterLockScreenWidgetKind = "CounterLockScreenWidget"

struct CounterWidgetEntry: TimelineEntry {
    let date: Date
    let selection: CounterSelection?
    let snapshot: CounterSnapshot?
    let errorMessage: String?
}

struct CounterWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CounterWidgetEntry {
        let selection = CounterSelection(
            organizationID: "preview",
            organizationName: "NiteOwl",
            counterID: "preview",
            environment: .niteOwl
        )
        return CounterWidgetEntry(
            date: .now,
            selection: selection,
            snapshot: CounterSnapshot(
                organizationID: "preview",
                counterID: "preview",
                organizationName: "NiteOwl",
                count: 42,
                updatedAt: .now
            ),
            errorMessage: nil
        )
    }

    func snapshot(
        for configuration: CounterWidgetConfigurationIntent,
        in context: Context
    ) async -> CounterWidgetEntry {
        await entry(for: configuration, fetchLive: false)
    }

    func timeline(
        for configuration: CounterWidgetConfigurationIntent,
        in context: Context
    ) async -> Timeline<CounterWidgetEntry> {
        let entry = await entry(for: configuration, fetchLive: true)
        let nextRefresh = Date.now.addingTimeInterval(15 * 60)
        return Timeline(entries: [entry], policy: .after(nextRefresh))
    }

    private func entry(
        for configuration: CounterWidgetConfigurationIntent,
        fetchLive: Bool
    ) async -> CounterWidgetEntry {
        let store = CounterSharedStore()
        let selection = configuration.counter?.selection ?? store?.selection()

        guard let selection else {
            return CounterWidgetEntry(
                date: .now,
                selection: nil,
                snapshot: nil,
                errorMessage: "Open Counter to select a Counter"
            )
        }

        if fetchLive {
            do {
                let snapshot = try await CounterRuntime
                    .apiClient(for: selection.environment)
                    .state(for: selection)
                return CounterWidgetEntry(
                    date: .now,
                    selection: selection,
                    snapshot: snapshot,
                    errorMessage: nil
                )
            } catch {
                // Fall back to the last cached value so a temporary network/auth
                // failure does not blank an otherwise useful widget.
            }
        }

        return CounterWidgetEntry(
            date: .now,
            selection: selection,
            snapshot: store?.snapshot(for: selection),
            errorMessage: nil
        )
    }
}

struct CounterWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CounterWidgetEntry

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                switch family {
                case .systemMedium:
                    medium(snapshot)
                case .accessoryCircular:
                    accessoryCircular(snapshot)
                case .accessoryRectangular:
                    accessoryRectangular(snapshot)
                case .accessoryInline:
                    accessoryInline(snapshot)
                default:
                    small(snapshot)
                }
            } else {
                unavailable
            }
        }
        .containerBackground(for: .widget) {
            if family == .systemSmall || family == .systemMedium {
                Color.black
            } else {
                Color.clear
            }
        }
        .widgetURL(URL(string: "dev.niteowl.counter:/"))
    }

    private func small(_ snapshot: CounterSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.organizationName)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer(minLength: 0)

            Text(snapshot.count.formatted())
                .font(.system(size: 58, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
    }

    private func medium(_ snapshot: CounterSnapshot) -> some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(snapshot.organizationName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Text(snapshot.count.formatted())
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            HStack(spacing: 10) {
                Button(intent: DecrementCounterIntent(counter: configuredCounter)) {
                    Image(systemName: "minus")
                        .font(.title2.bold())
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.black)
                .background(.yellow, in: Circle())

                Button(intent: IncrementCounterIntent(counter: configuredCounter)) {
                    Image(systemName: "plus")
                        .font(.title2.bold())
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .background(.blue, in: Circle())
            }
        }
        .foregroundStyle(.white)
    }

    private func accessoryCircular(_ snapshot: CounterSnapshot) -> some View {
        ZStack {
            AccessoryWidgetBackground()

            Text(snapshot.count.formatted())
                .font(.system(.title, design: .rounded, weight: .bold))
                .monospacedDigit()
                .minimumScaleFactor(0.55)
                .lineLimit(1)
                .padding(5)
        }
        .widgetAccentable()
    }

    private func accessoryRectangular(_ snapshot: CounterSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(snapshot.organizationName)
                .font(.caption2)
                .fontWeight(.semibold)
                .lineLimit(1)

            Text(snapshot.count.formatted())
                .font(.system(.title, design: .rounded, weight: .bold))
                .monospacedDigit()
                .minimumScaleFactor(0.65)
                .lineLimit(1)
        }
        .widgetAccentable()
    }

    private func accessoryInline(_ snapshot: CounterSnapshot) -> some View {
        Text("\(snapshot.organizationName) · \(snapshot.count.formatted())")
            .lineLimit(1)
            .widgetAccentable()
    }

    private var configuredCounter: CounterWidgetEntity? {
        entry.selection.map(CounterWidgetEntity.init(selection:))
    }

    @ViewBuilder
    private var unavailable: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "exclamationmark")
                    .font(.headline)
            }
            .widgetAccentable()
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Open Counter")
                    .font(.headline)
                Text("Choose a Counter")
                    .font(.caption2)
            }
            .widgetAccentable()
        case .accessoryInline:
            Text("Open Counter to choose a Counter")
                .widgetAccentable()
        default:
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "person.crop.circle.badge.exclamationmark")
                    .font(.title2)
                Text("Open Counter")
                    .font(.headline)
                Text(entry.errorMessage ?? "Sign in and choose a Counter for this widget.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            .foregroundStyle(.white)
        }
    }
}

struct CounterWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: counterWidgetKind,
            intent: CounterWidgetConfigurationIntent.self,
            provider: CounterWidgetProvider()
        ) { entry in
            CounterWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Counter")
        .description("Choose a NiteOwl Counter to monitor or control.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
        ])
    }
}

struct CounterLockScreenWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: counterLockScreenWidgetKind,
            intent: CounterWidgetConfigurationIntent.self,
            provider: CounterWidgetProvider()
        ) { entry in
            CounterWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Counter")
        .description("Monitor a NiteOwl Counter from the Lock Screen.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}
