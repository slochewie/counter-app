import SwiftUI
import WidgetKit

@main
struct CounterWidgetBundle: WidgetBundle {
    var body: some Widget {
        CounterWidget()
        CounterLockScreenWidget()
    }
}
