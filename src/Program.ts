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
} from "@effect/platform";
import { listen } from "./Listen.js";
import {
  Logger,
  Option,
  Schema,
  Config,
  Effect,
  Redacted,
  Layer,
  Ref,
  HashMap,
  Context,
} from "effect";
import { ParseError } from "effect/Cron";
import { Hash, randomBytes } from "crypto";
import {
  ApiResponse,
  ApiTweetPostRequest,
  TwitterTokenResponse,
  TwitterTokenResponseSchema,
} from "./Models.js";

const sessionCookieDefaults = {
  path: "/", // available everywhere
  httpOnly: true, // not accessible to JS (XSS protection)
  secure: true, // only sent over HTTPS
  sameSite: "lax" as const, // CSRF protection but still works for most logins
  priority: "high" as const, // browsers send this cookie earlier under pressure
  // domain: undefined      // let browser set to current domain (recommended unless multi-subdomain)
  // expires or maxAge: set depending on session strategy
};

const TWITTER_TWEET_MANAGE_URL = "https://api.x.com/2/tweets";
const TWITTER_OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const TWITTER_CLIENT_SECRET = Config.redacted(
  Config.string("TWITTER_CLIENT_SECRET")
);
const TWITTER_CLIENT_ID = Config.string("TWITTER_CLIENT_ID");
const CONFIG_APP_URL = Config.string("APP_URL");

export interface SessionStore {
  sessions: Ref.Ref<HashMap.HashMap<string, TwitterTokenResponse>>;
}

export class SessionStoreTag extends Context.Tag("SessionStore")<
  SessionStoreTag,
  Ref.Ref<HashMap.HashMap<string, TwitterTokenResponse>>
>() {}

export const SessionStoreLive = Layer.effect(
  SessionStoreTag,
  Ref.make(HashMap.empty<string, TwitterTokenResponse>())
);

/**
 * Generates a cryptographically secure random session ID using an Effect.
 * The ID is a base64-encoded string, which is safe for use in URLs and cookies.
 *
 * @param length The length of the random bytes to generate. A higher value
 * increases security. 32 bytes (44 characters in base64) is a
 * common and secure choice.
 * @returns An Effect that resolves to the generated session ID string on success,
 * or an Error on failure.
 */
function generateSessionId(
  length: number = 32
): Effect.Effect<string, Error, never> {
  return Effect.async((resume) =>
    randomBytes(length, (err, buf) => {
      if (err === null) {
        var sessionId = buf.toString("base64");

        return resume(Effect.succeed(sessionId));
      } else {
        resume(Effect.fail(err));
      }
    })
  );
}

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

const redirect_to_auth = (client_id: string) =>
  Effect.sync(() => {
    const rootUrl = "https://twitter.com/i/oauth2/authorize";
    const options = {
      redirect_uri: "http://localhost:3000/oauth/twitter",
      client_id: client_id,
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
    return `${rootUrl}?${qs}`;
  });

const composed = Effect.gen(function* () {
  const id = yield* TWITTER_CLIENT_ID;
  const url = yield* redirect_to_auth(id);
  return HttpServerResponse.redirect(url.toString());
});

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

    const response = yield* client.execute(req);

    const json = yield* response.json;

    const postResponse = yield* Schema.decodeUnknown(ApiResponse)(json);
    return postResponse;
  });

const makeAuthRequest = (url: string | URL) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const id = yield* TWITTER_CLIENT_ID;
    const secret = yield* TWITTER_CLIENT_SECRET;

    const req = HttpClientRequest.post(url).pipe(
      HttpClientRequest.basicAuth(id, Redacted.value(secret))
    );

    const response = yield* client.execute(req);

    const json = yield* response.json;

    const tokenResponse = yield* Schema.decodeUnknown(
      TwitterTokenResponseSchema
    )(json);
    return tokenResponse;
  }).pipe(Effect.provide(FetchHttpClient.layer));

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        const sessions = yield* SessionStoreTag;
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
        const sessions = yield* SessionStoreTag;
        const { state, code } = getAuthParams(
          "http://localhost:3000" + request.url
        );

        if (state === undefined || code === undefined) {
          throw new ParseError({ message: "query parse error" });
        }

        const client_id = yield* TWITTER_CLIENT_ID;

        const authRequest = Url.setUrlParams(
          new URL(TWITTER_OAUTH_TOKEN_URL),
          UrlParams.fromInput([
            ["code", code],
            ["client_id", client_id],
            ["code_verifier", "8KxxO-RPl0bLSxX5AWwgdiFbMnry_VOKzFeIlVA7NoA"],
            ["redirect_uri", `http://localhost:3000/oauth/twitter`],
            ["grant_type", "authorization_code"],
          ])
        );

        const tokenResponse = yield* makeAuthRequest(authRequest);

        const sessionId = yield* generateSessionId();

        yield* Ref.update(sessions, (state) =>
          HashMap.set(state, sessionId, tokenResponse)
        );

        return yield* HttpServerResponse.redirect("/").pipe(
          HttpServerResponse.setCookie(
            "sessionId",
            sessionId,
            sessionCookieDefaults
          )
        );
      })
    )
  ),
  HttpRouter.get("/login", composed),
  HttpRouter.post(
    "/tweet",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        // NOTE you could pack this cookies session id thing into a either or with either http.res not token not found or auth_token
        const session = yield* SessionStoreTag;
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
  )
);

const app = router.pipe(HttpServer.serve(HttpMiddleware.logger));

listen(
  // provide the pretty logger here so that we make pretty logs with the Effect.log* functions
  app.pipe(
    Layer.provide(SessionStoreLive),
    Layer.provide(Logger.pretty),
    Layer.provide(FetchHttpClient.layer)
  ),
  3000
);
