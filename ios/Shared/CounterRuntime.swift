import Foundation

struct CounterRuntime {
    static func tokenStore(bundle: Bundle = .main) -> CounterTokenStore {
        CounterTokenStore(accessGroup: bundle.object(forInfoDictionaryKey: "CounterKeychainAccessGroup") as? String)
    }

    static func oauthClient(
        for environment: CounterEnvironment,
        bundle: Bundle = .main
    ) -> CounterOAuthClient {
        CounterOAuthClient(
            configuration: environment.oauthConfiguration,
            tokenStore: tokenStore(bundle: bundle)
        )
    }

    static func apiClient(
        for environment: CounterEnvironment,
        bundle: Bundle = .main
    ) -> CounterAPIClient {
        CounterAPIClient(oauth: oauthClient(for: environment, bundle: bundle))
    }
}
