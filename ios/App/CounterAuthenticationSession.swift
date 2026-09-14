import AuthenticationServices
import Foundation
import UIKit

@MainActor
final class CounterAuthenticationSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func signIn(using oauth: CounterOAuthClient) async throws -> CounterOAuthToken {
        let pkce = PKCEPair.generate()
        let state = UUID().uuidString
        let authorizationURL = try await oauth.authorizationURL(pkce: pkce, state: state)

        let callbackURL: URL = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<URL, any Error>) in
            let session = ASWebAuthenticationSession(
                url: authorizationURL,
                callbackURLScheme: CounterOAuthConfiguration.callbackScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: CounterAuthenticationError.missingCallback)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session

            guard session.start() else {
                self.session = nil
                continuation.resume(throwing: CounterAuthenticationError.unableToStart)
                return
            }
        }

        session = nil
        let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)
        var values: [String: String] = [:]
        for item in components?.queryItems ?? [] {
            values[item.name] = item.value ?? ""
        }

        if let error = values["error"] {
            throw CounterAuthenticationError.authorizationDenied(
                error,
                values["error_description"]
            )
        }
        guard values["state"] == state else {
            throw CounterAuthenticationError.stateMismatch
        }
        guard let code = values["code"], !code.isEmpty else {
            throw CounterAuthenticationError.missingCode
        }

        return try await oauth.exchangeAuthorizationCode(code, verifier: pkce.verifier)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        for scene in scenes where scene.activationState == .foregroundActive {
            if let window = scene.windows.first(where: { $0.isKeyWindow }) {
                return window
            }
        }
        return ASPresentationAnchor()
    }
}

enum CounterAuthenticationError: Error, LocalizedError {
    case unableToStart
    case missingCallback
    case stateMismatch
    case missingCode
    case authorizationDenied(String, String?)

    var errorDescription: String? {
        switch self {
        case .unableToStart:
            return "Unable to start Counter sign-in."
        case .missingCallback:
            return "Counter sign-in did not return a callback URL."
        case .stateMismatch:
            return "Counter sign-in returned an invalid OAuth state."
        case .missingCode:
            return "Counter sign-in did not return an authorization code."
        case .authorizationDenied(let code, let description):
            return description ?? "Counter authorization failed: \(code)"
        }
    }
}
