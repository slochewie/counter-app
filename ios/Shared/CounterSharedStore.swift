import Foundation

struct CounterSharedStore: @unchecked Sendable {
    static let appGroup = "group.dev.niteowl.counter"

    private let defaults: UserDefaults

    init?() {
        guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
            return nil
        }
        self.defaults = defaults
    }

    func selection() -> CounterSelection? {
        guard let data = defaults.data(forKey: "counter.selection") else {
            return nil
        }
        return try? JSONDecoder().decode(CounterSelection.self, from: data)
    }

    func saveSelection(_ selection: CounterSelection) throws {
        defaults.set(try JSONEncoder().encode(selection), forKey: "counter.selection")
    }

    func selections() -> [CounterSelection] {
        guard let data = defaults.data(forKey: "counter.selections") else {
            return selection().map { [$0] } ?? []
        }
        return (try? JSONDecoder().decode([CounterSelection].self, from: data)) ?? []
    }

    func saveSelections(_ selections: [CounterSelection]) throws {
        defaults.set(try JSONEncoder().encode(selections), forKey: "counter.selections")
    }

    func snapshot() -> CounterSnapshot? {
        guard let data = defaults.data(forKey: "counter.snapshot") else {
            return nil
        }
        return try? JSONDecoder().decode(CounterSnapshot.self, from: data)
    }

    func snapshot(for selection: CounterSelection) -> CounterSnapshot? {
        let key = snapshotKey(for: selection)
        guard let data = defaults.data(forKey: key) else {
            if selection == self.selection() {
                return snapshot()
            }
            return nil
        }
        return try? JSONDecoder().decode(CounterSnapshot.self, from: data)
    }

    func saveSnapshot(_ snapshot: CounterSnapshot) throws {
        let data = try JSONEncoder().encode(snapshot)
        defaults.set(data, forKey: "counter.snapshot")

        if let matchingSelection = selections().first(where: {
            $0.organizationID == snapshot.organizationID && $0.counterID == snapshot.counterID
        }) ?? selection() {
            defaults.set(data, forKey: snapshotKey(for: matchingSelection))
        }
    }

    func saveSnapshot(_ snapshot: CounterSnapshot, for selection: CounterSelection) throws {
        let data = try JSONEncoder().encode(snapshot)
        defaults.set(data, forKey: snapshotKey(for: selection))

        if selection == self.selection() {
            defaults.set(data, forKey: "counter.snapshot")
        }
    }

    func clear() {
        for selection in selections() {
            defaults.removeObject(forKey: snapshotKey(for: selection))
        }
        defaults.removeObject(forKey: "counter.selection")
        defaults.removeObject(forKey: "counter.selections")
        defaults.removeObject(forKey: "counter.snapshot")
    }

    private func snapshotKey(for selection: CounterSelection) -> String {
        "counter.snapshot.\(selection.environment.rawValue).\(selection.organizationID).\(selection.counterID)"
    }
}
