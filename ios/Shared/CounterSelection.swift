import Foundation

struct CounterSelection: Codable, Sendable, Equatable, Hashable {
    let organizationID: String
    let organizationName: String
    let counterID: String
    let environment: CounterEnvironment
}

enum CounterEnvironment: String, Codable, Sendable, CaseIterable, Hashable {
    case niteOwl
    case mccarthys

    var oauthConfiguration: CounterOAuthConfiguration {
        switch self {
        case .niteOwl:
            return .niteOwl
        case .mccarthys:
            return .mccarthys
        }
    }
}

struct CounterSnapshot: Codable, Sendable, Equatable {
    let organizationID: String
    let counterID: String
    let organizationName: String
    let count: Int
    let updatedAt: Date
}
