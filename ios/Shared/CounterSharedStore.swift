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

    func snapshot() -> CounterSnapshot? {
        guard let data = defaults.data(forKey: "counter.snapshot") else {
            return nil
        }
        return try? JSONDecoder().decode(CounterSnapshot.self, from: data)
    }

    func saveSnapshot(_ snapshot: CounterSnapshot) throws {
        defaults.set(try JSONEncoder().encode(snapshot), forKey: "counter.snapshot")
    }

    func clear() {
        defaults.removeObject(forKey: "counter.selection")
        defaults.removeObject(forKey: "counter.snapshot")
    }
}
