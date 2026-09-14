import SwiftUI
import WidgetKit

struct CounterWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: CounterSnapshot?
    let errorMessage: String?
}

struct CounterWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> CounterWidgetEntry {
        CounterWidgetEntry(
            date: .now,
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

    func getSnapshot(in context: Context, completion: @escaping (CounterWidgetEntry) -> Void) {
        let cached = CounterSharedStore()?.snapshot()
        completion(CounterWidgetEntry(date: .now, snapshot: cached, errorMessage: nil))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CounterWidgetEntry>) -> Void) {
        Task {
            let entry = await loadEntry()
            let nextRefresh = Date.now.addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }

    private func loadEntry() async -> CounterWidgetEntry {
        guard let store = CounterSharedStore(), let selection = store.selection() else {
            return CounterWidgetEntry(
                date: .now,
                snapshot: store?.snapshot(),
                errorMessage: "Open Counter to select a Counter"
            )
        }

        do {
            let api = CounterRuntime.apiClient(for: selection.environment)
            let snapshot = try await api.state(for: selection)
            return CounterWidgetEntry(date: .now, snapshot: snapshot, errorMessage: nil)
        } catch {
            return CounterWidgetEntry(
                date: .now,
                snapshot: store.snapshot(),
                errorMessage: error.localizedDescription
            )
        }
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
                default:
                    small(snapshot)
                }
            } else {
                unavailable
            }
        }
        .containerBackground(.black, for: .widget)
        .widgetURL(URL(string: "dev.niteowl.counter:/"))
    }

    private func small(_ snapshot: CounterSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(snapshot.organizationName)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer(minLength: 0)

            Text(snapshot.count.formatted())
                .font(.system(size: 54, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Spacer(minLength: 0)

            Text("Counter")
                .font(.caption2)
                .foregroundStyle(.secondary)
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
                Button(intent: DecrementCounterIntent()) {
                    Image(systemName: "minus")
                        .font(.title2.bold())
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.black)
                .background(.yellow, in: Circle())

                Button(intent: IncrementCounterIntent()) {
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

    private var unavailable: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.title2)
            Text("Open Counter")
                .font(.headline)
            Text(entry.errorMessage ?? "Sign in and select a Counter.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .foregroundStyle(.white)
    }
}

struct CounterWidget: Widget {
    static let kind = "CounterWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: CounterWidgetProvider()) { entry in
            CounterWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Counter")
        .description("See and update the selected NiteOwl Counter.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
