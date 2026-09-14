import Foundation

struct CounterOAuthToken: Codable, Sendable, Equatable {
    let accessToken: String
    let refreshToken: String?
    let tokenType: String
    let scope: String?
    let expiresAt: Date

    var isUsable: Bool {
        expiresAt.timeIntervalSinceNow > 60
    }
}

struct CounterOAuthTokenResponse: Decodable, Sendable {
    let accessToken: String
    let refreshToken: String?
    let tokenType: String
    let scope: String?
    let expiresIn: Double

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case scope
        case expiresIn = "expires_in"
    }

    func token(previousRefreshToken: String? = nil, now: Date = .now) -> CounterOAuthToken {
        CounterOAuthToken(
            accessToken: accessToken,
            refreshToken: refreshToken ?? previousRefreshToken,
            tokenType: tokenType,
            scope: scope,
            expiresAt: now.addingTimeInterval(expiresIn)
        )
    }
}
