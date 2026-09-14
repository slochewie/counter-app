import Foundation

actor CounterAPIClient {
    private let oauth: CounterOAuthClient
    private let session: URLSession
    private let sharedStore: CounterSharedStore?

    init(
        oauth: CounterOAuthClient,
        session: URLSession = .shared,
        sharedStore: CounterSharedStore? = CounterSharedStore()
    ) {
        self.oauth = oauth
        self.session = session
        self.sharedStore = sharedStore
    }

    func availableCounters(in environment: CounterEnvironment) async throws -> [CounterSelection] {
        let configuration = environment.oauthConfiguration
        let url = configuration.counterBaseURL.appending(path: "api/counter/available")
        let response: AvailableCountersResponse = try await request(url: url, method: "GET")
        let selections = response.counters.map {
            CounterSelection(
                organizationID: $0.organizationId,
                organizationName: $0.organizationName,
                counterID: $0.counterId,
                environment: environment
            )
        }

        if selections.count == 1, let selection = selections.first {
            try sharedStore?.saveSelection(selection)
        }

        return selections
    }

    func state(for selection: CounterSelection) async throws -> CounterSnapshot {
        let configuration = selection.environment.oauthConfiguration
        var components = URLComponents(
            url: configuration.counterBaseURL.appending(path: "api/counter/state"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "organizationId", value: selection.organizationID),
            URLQueryItem(name: "counterId", value: selection.counterID),
        ]
        guard let url = components?.url else {
            throw CounterAPIError.invalidURL
        }

        let response: CounterStateResponse = try await request(url: url, method: "GET")
        let snapshot = CounterSnapshot(
            organizationID: selection.organizationID,
            counterID: selection.counterID,
            organizationName: selection.organizationName,
            count: response.count,
            updatedAt: .now
        )
        try sharedStore?.saveSnapshot(snapshot)
        return snapshot
    }

    func send(_ command: CounterCommand, for selection: CounterSelection) async throws -> CounterSnapshot {
        let configuration = selection.environment.oauthConfiguration
        let url = configuration.counterBaseURL.appending(path: "api/counter/command")
        let body = CounterCommandRequest(
            organizationId: selection.organizationID,
            counterId: selection.counterID,
            action: command.rawValue
        )
        let response: CounterStateResponse = try await request(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )
        let snapshot = CounterSnapshot(
            organizationID: selection.organizationID,
            counterID: selection.counterID,
            organizationName: selection.organizationName,
            count: response.count,
            updatedAt: .now
        )
        try sharedStore?.saveSnapshot(snapshot)
        return snapshot
    }

    private func request<T: Decodable>(
        url: URL,
        method: String,
        body: Data? = nil
    ) async throws -> T {
        let accessToken = try await oauth.validAccessToken()
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CounterAPIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let apiError = try? JSONDecoder().decode(CounterAPIErrorResponse.self, from: data)
            throw CounterAPIError.http(http.statusCode, apiError?.error)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum CounterCommand: String, Codable, Sendable {
    case increment
    case decrement
}

private struct CounterCommandRequest: Encodable {
    let organizationId: String
    let counterId: String
    let action: String
}

private struct CounterStateResponse: Decodable {
    let count: Int
}

private struct AvailableCountersResponse: Decodable {
    let counters: [AvailableCounterResponse]
}

private struct AvailableCounterResponse: Decodable {
    let organizationId: String
    let organizationName: String
    let counterId: String
}

private struct CounterAPIErrorResponse: Decodable {
    let error: String?
}

enum CounterAPIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case http(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Unable to build the Counter API URL."
        case .invalidResponse:
            return "The Counter API returned an invalid response."
        case .http(let status, let message):
            return message ?? "Counter API request failed with HTTP \(status)."
        }
    }
}
