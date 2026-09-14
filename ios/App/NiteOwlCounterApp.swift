import SwiftUI

@main
struct NiteOwlCounterApp: App {
    @StateObject private var model = CounterAppModel()

    var body: some Scene {
        WindowGroup {
            CounterRootView(model: model)
                .task {
                    await model.restore()
                }
        }
    }
}
