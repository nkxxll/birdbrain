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
} from "@effect/platform";
import { listen } from "./Listen.js";
import {
  Option,
  Schema,
  Config,
  Effect,
  Redacted,
  Console,
  Layer,
  Ref,
  HashMap,
  Context,
} from "effect";
import { ParseError } from "effect/Cron";
import { randomBytes } from "crypto";

const sessionCookieDefaults = {
  path: "/", // available everywhere
  httpOnly: true, // not accessible to JS (XSS protection)
  secure: true, // only sent over HTTPS
  sameSite: "lax" as const, // CSRF protection but still works for most logins
  priority: "high" as const, // browsers send this cookie earlier under pressure
  // domain: undefined      // let browser set to current domain (recommended unless multi-subdomain)
  // expires or maxAge: set depending on session strategy
};

const TWITTER_OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const TWITTER_CLIENT_SECRET = Config.redacted(
  Config.string("TWITTER_CLIENT_SECRET")
);
const TWITTER_CLIENT_ID = Config.string("TWITTER_CLIENT_ID");
const CONFIG_APP_URL = Config.string("APP_URL");

const basicAuthToken = (id: string, secret: string) =>
  Buffer.from(`${id}:${secret}`, "utf8").toString("base64");

export interface SessionStore {
  sessions: Ref.Ref<HashMap.HashMap<string, TwitterTokenResponse>>;
}

export class SessionStoreTag extends Context.Tag("SessionStore")<
  SessionStoreTag,
  SessionStore
>() {}

export const SessionStoreLive = Layer.effect(
  SessionStoreTag,
  Effect.map(
    Ref.make(HashMap.empty<string, TwitterTokenResponse>()),
    (sessions) => ({ sessions })
  )
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
  // We use Effect.gen to write the code in a sequential, imperative style.
  // We yield from the NodeRandom service to get a secure buffer of random bytes.

  return Effect.async((resume) =>
    randomBytes(length, (err, buf) => {
      if (err === null) {
        // We convert the buffer to a base64 string for a compact, readable format.
        // Effect handles any potential errors during the process.
        var sessionId = buf.toString("base64");

        // The Effect resolves to the final session ID string.
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
      redirect_uri: "http://localhost:3000/oauth/twitter", // client url cannot be http://localhost:3000/ or http://127.0.0.1:3000/
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

const TwitterTokenResponseSchema = Schema.Struct({
  token_type: Schema.Literal("bearer"),
  expires_in: Schema.Number,
  access_token: Schema.String,
  scope: Schema.String,
});

type TwitterTokenResponse = Schema.Schema.Type<
  typeof TwitterTokenResponseSchema
>;

const makeRequest = (url: string | URL) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const id = yield* TWITTER_CLIENT_ID;
    const secret = yield* TWITTER_CLIENT_SECRET;

    const req = HttpClientRequest.post(url).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Basic ${basicAuthToken(id, Redacted.value(secret))}`
      )
    );

    const response = yield* client.execute(req);
    yield* Console.log(`received response ${JSON.stringify(response)}`);

    const json = yield* response.json;
    yield* Console.log(`received json ${json}`);

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
        const { sessions } = yield* SessionStoreTag;
        const kv = yield* Ref.get(sessions);
        const sessionId = req.cookies["sessionId"];
        if (!sessionId) {
          return HttpServerResponse.html(
            'no session id Welcome login buddy <a href="/login">login</a>'
          );
        }
        // yield* Console.log(appState);
        // const tokenResponse = HashMap.get(appState, sessionId);
        const tokenResponse = HashMap.get(kv, sessionId);

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
        const { sessions } = yield* SessionStoreTag;
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

        yield* Console.log(authRequest);
        const tokenResponse = yield* makeRequest(authRequest);

        const sessionId = yield* generateSessionId();

        yield* Ref.update(sessions, (state) =>
          HashMap.set(state, sessionId, tokenResponse)
        );
        // appState = HashMap.set(appState, sessionId, tokenResponse);

        const kv = yield* Ref.get(sessions);
        yield* Console.log(`kv after update ${kv}`);

        yield* Console.log(`session id is: ${sessionId}`);

        return yield* HttpServerResponse.redirect("/").pipe(
          HttpServerResponse.setCookie(
            "sessionId",
            sessionId,
            sessionCookieDefaults
          )
        );
      }).pipe(
        Effect.catchTags({
          CookieError: (err) =>
            HttpServerResponse.text(`Cookie error: ${err.message}`, {
              status: 500,
            }),
          ConfigError: (err) =>
            HttpServerResponse.text(`Config error: ${err.message}`, {
              status: 500,
            }),
          RequestError: (err) =>
            HttpServerResponse.text(`Request error: ${err.message}`, {
              status: 500,
            }),
          ResponseError: (err) =>
            HttpServerResponse.text(`Response error: ${err.message}`, {
              status: 500,
            }),
          ParseError: (err) =>
            HttpServerResponse.text(`Parse error: ${err.message}`, {
              status: 500,
            }),
        })
      )
    )
  ),
  HttpRouter.get(
    "/login",
    composed.pipe(
      Effect.catchTags({
        ConfigError: (err) =>
          HttpServerResponse.text(`Config error: ${err}`, { status: 500 }),
      })
    )
  )
);

const app = router.pipe(HttpServer.serve(HttpMiddleware.logger));

listen(app.pipe(Layer.provide(SessionStoreLive)), 3000);
