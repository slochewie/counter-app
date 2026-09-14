package dev.niteowl.counter.data

enum class CounterEnvironment {
    NITEOWL,
    MCCARTHYS,
}

data class CounterSelection(
    val organizationId: String,
    val organizationName: String,
    val counterId: String,
    val environment: CounterEnvironment,
)

data class CounterSnapshot(
    val organizationId: String,
    val organizationName: String,
    val counterId: String,
    val count: Int,
)

enum class CounterCommand(val wireValue: String) {
    INCREMENT("increment"),
    DECREMENT("decrement"),
    RESET("reset"),
}
