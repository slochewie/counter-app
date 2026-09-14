import Foundation

struct CounterOAuthConfiguration: Sendable, Equatable {
    static let clientID = "TiwEzVZDCdgvFUGciWMzBfFBqjzhmEXt"
    static let redirectURI = "dev.niteowl.counter:/oauth/callback"
    static let callbackScheme = "dev.niteowl.counter"
    static let scopes = [
        "openid",
        "offline_access",
        "counter:read",
        "counter:write",
    ]

    let authBaseURL: URL
    let counterBaseURL: URL

    static let niteOwl = CounterOAuthConfiguration(
        authBaseURL: URL(string: "https://console.niteowl.dev")!,
        counterBaseURL: URL(string: "https://counter.niteowl.dev")!
    )

    static let mccarthys = CounterOAuthConfiguration(
        authBaseURL: URL(string: "https://console.mccarthysirishpub.com")!,
        counterBaseURL: URL(string: "https://counter.mccarthysirishpub.com")!
    )

    var authorizationEndpoint: URL {
        authBaseURL.appending(path: "api/auth/oauth2/authorize")
    }

    var tokenEndpoint: URL {
        authBaseURL.appending(path: "api/auth/oauth2/token")
    }

    var resource: String {
        counterBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}
