import Foundation

actor CounterOAuthClient {
    let configuration: CounterOAuthConfiguration
    let tokenStore: CounterTokenStore
    private let session: URLSession

    init(
        configuration: CounterOAuthConfiguration,
        tokenStore: CounterTokenStore,
        session: URLSession = .shared
    ) {
        self.configuration = configuration
        self.tokenStore = tokenStore
        self.session = session
    }

    func authorizationURL(pkce: PKCEPair, state: String) throws -> URL {
        var components = URLComponents(
            url: configuration.authorizationEndpoint,
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: CounterOAuthConfiguration.clientID),
            URLQueryItem(name: "redirect_uri", value: CounterOAuthConfiguration.redirectURI),
            URLQueryItem(name: "scope", value: CounterOAuthConfiguration.scopes.joined(separator: " ")),
            URLQueryItem(name: "resource", value: configuration.resource),
            URLQueryItem(name: "code_challenge", value: pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
        ]
        guard let url = components?.url else {
            throw CounterOAuthError.invalidAuthorizationURL
        }
        return url
    }

    func exchangeAuthorizationCode(_ code: String, verifier: String) async throws -> CounterOAuthToken {
        let response: CounterOAuthTokenResponse = try await tokenRequest([
            "grant_type": "authorization_code",
            "client_id": CounterOAuthConfiguration.clientID,
            "code": code,
            "redirect_uri": CounterOAuthConfiguration.redirectURI,
            "code_verifier": verifier,
            "resource": configuration.resource,
        ])
        let token = response.token()
        try tokenStore.save(token)
        return token
    }

    func validAccessToken() async throws -> String {
        guard let stored = try tokenStore.load() else {
            throw CounterOAuthError.notAuthenticated
        }
        if stored.isUsable {
            return stored.accessToken
        }
        return try await refresh(stored).accessToken
    }

    func refresh(_ current: CounterOAuthToken? = nil) async throws -> CounterOAuthToken {
        let stored = try current ?? tokenStore.load()
        guard let stored, let refreshToken = stored.refreshToken else {
            throw CounterOAuthError.noRefreshToken
        }

        do {
            // Do not resend the authorization scopes during a refresh. The
            // refresh token already carries the scopes granted during the
            // authorization-code flow, and the provider rejects OIDC scopes
            // such as `openid` when they are re-requested here.
            let response: CounterOAuthTokenResponse = try await tokenRequest([
                "grant_type": "refresh_token",
                "client_id": CounterOAuthConfiguration.clientID,
                "refresh_token": refreshToken,
                "resource": configuration.resource,
            ])
            let token = response.token(previousRefreshToken: refreshToken)
            try tokenStore.save(token)
            return token
        } catch let error as CounterOAuthError {
            if case .oauth(let code, _) = error, code == "invalid_grant" {
                try? tokenStore.clear()
                throw CounterOAuthError.sessionExpired
            }
            throw error
        }
    }

    func signOut() throws {
        try tokenStore.clear()
    }

    private func tokenRequest<T: Decodable>(_ parameters: [String: String]) async throws -> T {
        var request = URLRequest(url: configuration.tokenEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = formEncoded(parameters).data(using: .utf8)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw CounterOAuthError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = try? JSONDecoder().decode(OAuthErrorResponse.self, from: data)
            throw CounterOAuthError.oauth(
                body?.error ?? "http_\(http.statusCode)",
                body?.errorDescription
            )
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func formEncoded(_ parameters: [String: String]) -> String {
        parameters
            .sorted { $0.key < $1.key }
            .map { "\(formComponent($0.key))=\(formComponent($0.value))" }
            .joined(separator: "&")
    }

    private func formComponent(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "+&=")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

private struct OAuthErrorResponse: Decodable {
    let error: String
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
    }
}

enum CounterOAuthError: Error, LocalizedError {
    case invalidAuthorizationURL
    case invalidResponse
    case notAuthenticated
    case noRefreshToken
    case sessionExpired
    case oauth(String, String?)

    var errorDescription: String? {
        switch self {
        case .invalidAuthorizationURL:
            return "Unable to create the Counter authorization URL."
        case .invalidResponse:
            return "The Counter authorization server returned an invalid response."
        case .notAuthenticated:
            return "Counter is not signed in."
        case .noRefreshToken:
            return "No Counter refresh token is available."
        case .sessionExpired:
            return "Your Counter session has expired. Sign out and sign in again."
        case .oauth(let code, let description):
            return description ?? "OAuth error: \(code)"
        }
    }
}
