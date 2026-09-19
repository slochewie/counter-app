package dev.niteowl.counter.data

enum class CounterEnvironment {
    NITEOWL,
    MCCARTHYS,
}

data class CounterSelection(
    val organizationId: String,
    val organizationName: String,
    val counterId: String,
    val counterName: String?,
    val environment: CounterEnvironment,
) {
    val counterDisplayName: String
        get() = counterName?.trim()?.takeIf { it.isNotEmpty() } ?: counterId
}

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
