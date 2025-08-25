import {
  HttpRouter,
  HttpServer,
  HttpServerResponse,
  HttpMiddleware,
  HttpServerRequest,
  UrlParams,
  Url,
  HttpClient,
  FetchHttpClient,
  HttpClientRequest,
  HttpBody,
  HttpClientResponse,
} from "@effect/platform";
import { listen, main, cron } from "./Compose.js";
import {
  Logger,
  Option,
  Schema,
  Effect,
  Redacted,
  Layer,
  Ref,
  HashMap,
} from "effect";
import { ParseError } from "effect/Cron";
import {
  ApiResponse,
  ApiTweetPostRequest,
  TwitterTokenResponseSchema,
} from "./Models.js";
import { AppConfig, SessionStore } from "./Services.js";
import { generateRandomBytes } from "./Utils.js";
import { SessionTokenMiddleware } from "./Middleware.js";

const sessionCookieDefaults = {
  path: "/", // available everywhere
  httpOnly: true, // not accessible to JS (XSS protection)
  secure: true, // only sent over HTTPS
  sameSite: "lax" as const, // CSRF protection but still works for most logins
  priority: "high" as const, // browsers send this cookie earlier under pressure
};

const TWITTER_TWEET_MANAGE_URL = "https://api.x.com/2/tweets";
const TWITTER_OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const TWITTER_REDIRECT_URL = "http://localhost:3000/oauth/twitter";

function getAuthParams(url: string): {
  state: string | undefined;
  code: string | undefined;
} {
  const params = new URL(url).searchParams;

  return {
    state: params.get("state") ?? undefined,
    code: params.get("code") ?? undefined,
  };
}

const makeTweetPostRequest = (text: string, authToken: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const body: ApiTweetPostRequest = {
      text: text,
    };

    const req = HttpClientRequest.post(TWITTER_TWEET_MANAGE_URL).pipe(
      HttpClientRequest.bearerToken(authToken),
      HttpClientRequest.setBody(
        HttpBody.text(JSON.stringify(body), "application/json")
      )
    );
    const postResponse = yield* client.execute(req);

    return yield* HttpClientResponse.schemaBodyJson(ApiResponse)(postResponse);
  });

const makeAuthRequest = (url: string | URL) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const client = yield* HttpClient.HttpClient;

    const req = HttpClientRequest.post(url).pipe(
      HttpClientRequest.basicAuth(
        config.clientId,
        Redacted.value(config.clientSecret)
      )
    );

    const response = yield* client.execute(req);

    const json = yield* response.json;

    const tokenResponse = yield* Schema.decodeUnknown(
      TwitterTokenResponseSchema
    )(json);
    return tokenResponse;
  }).pipe(Effect.provide(FetchHttpClient.layer));

const authenticatedRouter = HttpRouter.empty.pipe(
  HttpRouter.post(
    "/tweet",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        // NOTE you could pack this cookies session id thing into a either or with either http.res not token not found or auth_token
        const session = yield* SessionStore;
        const sessionId = Option.fromNullable(req.cookies["sessionId"]);
        if (Option.isNone(sessionId)) {
          return HttpServerResponse.html(
            'no session id Welcome login buddy <a href="/login">login</a>'
          );
        }
        const kv = yield* Ref.get(session);
        const tokenResponse = HashMap.get(kv, sessionId.value);
        if (Option.isNone(tokenResponse)) {
          return HttpServerResponse.html(
            'no session id found in session store... Welcome login buddy <a href="/login">login</a>'
          );
        }
        // END NOTE
        const json = yield* req.json;

        yield* Effect.log(`Json from the client: ${json}`);
        const request: ApiTweetPostRequest = yield* Schema.decodeUnknown(
          ApiTweetPostRequest
        )(json);

        const apiResponse = yield* makeTweetPostRequest(
          request.text,
          tokenResponse.value.access_token
        );

        return yield* HttpServerResponse.json(JSON.stringify(apiResponse));
      })
    )
  ),
  HttpRouter.use(SessionTokenMiddleware)
);

const router = HttpRouter.empty.pipe(
  HttpRouter.mount("/", authenticatedRouter),
  HttpRouter.get(
    "/",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        const sessions = yield* SessionStore;
        const kv = yield* Ref.get(sessions);
        const sessionId = Option.fromNullable(req.cookies["sessionId"]);
        if (Option.isNone(sessionId)) {
          return HttpServerResponse.html(
            'no session id Welcome login buddy <a href="/login">login</a>'
          );
        }
        const tokenResponse = HashMap.get(kv, sessionId.value);

        return HttpServerResponse.text(
          JSON.stringify(
            Option.isNone(tokenResponse)
              ? "no token res for this ession"
              : Schema.encodeSync(TwitterTokenResponseSchema)(
                  tokenResponse.value
                )
          )
        );
      })
    )
  ),
  HttpRouter.get(
    "/oauth/twitter",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      Effect.gen(function* () {
        const config = yield* AppConfig;
        const sessions = yield* SessionStore;
        const { state, code } = getAuthParams(
          "http://localhost:3000" + request.url
        );

        if (state === undefined || code === undefined) {
          throw new ParseError({ message: "query parse error" });
        }

        const authRequest = Url.setUrlParams(
          new URL(TWITTER_OAUTH_TOKEN_URL),
          UrlParams.fromInput([
            ["code", code],
            ["client_id", config.clientId],
            ["code_verifier", "8KxxO-RPl0bLSxX5AWwgdiFbMnry_VOKzFeIlVA7NoA"],
            ["redirect_uri", TWITTER_REDIRECT_URL],
            ["grant_type", "authorization_code"],
          ])
        );

        const tokenResponse = yield* makeAuthRequest(authRequest);

        const random = yield* generateRandomBytes();
        const sessionId = random.toString("base64");

        yield* Ref.update(sessions, (state) =>
          HashMap.set(state, sessionId, tokenResponse)
        );

        return yield* HttpServerResponse.redirect(config.appUrl).pipe(
          HttpServerResponse.setCookie(
            "sessionId",
            sessionId,
            sessionCookieDefaults
          )
        );
      })
    )
  ),
  HttpRouter.get(
    "/login",
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const rootUrl = "https://twitter.com/i/oauth2/authorize";
      const options = {
        redirect_uri: TWITTER_REDIRECT_URL,
        client_id: config.clientId,
        state: "state",
        response_type: "code",
        code_challenge: "y_SfRG4BmOES02uqWeIkIgLQAlTBggyf_G7uKT51ku8",
        code_challenge_method: "S256",
        scope: [
          "users.email",
          "users.read",
          "tweet.write",
          "tweet.read",
          "follows.read",
          "follows.write",
        ].join(" "), // add/remove scopes as needed
      };
      const qs = new URLSearchParams(options).toString();
      const url = `${rootUrl}?${qs}`;
      return HttpServerResponse.redirect(url);
    })
  )
);

const app = router.pipe(HttpServer.serve(HttpMiddleware.logger));

const listenEffect = listen(
  // provide the pretty logger here so that we make pretty logs with the Effect.log* functions
  app.pipe(
    Layer.provide(AppConfig.Default),
    Layer.provide(SessionStore.Default),
    Layer.provide(Logger.pretty),
    Layer.provide(FetchHttpClient.layer)
  ),
  3000
);

const cronEffect = cron();

main(listenEffect, cronEffect);
