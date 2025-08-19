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
import { Schema, Config, Effect, Redacted, Console } from "effect";
import { redacted } from "effect/Config";
import { ParseError } from "effect/Cron";

const TWITTER_OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const TWITTER_CLIENT_SECRET = Config.redacted(
  Config.string("TWITTER_CLIENT_SECRET")
);
const TWITTER_CLIENT_ID = Config.string("TWITTER_CLIENT_ID");
const CONFIG_APP_URL = Config.string("APP_URL");

const basicAuthToken = (id: string, secret: string) =>
  Buffer.from(`${id}:${secret}`, "utf8").toString("base64");

let token = "";

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

// 1. Define the Schema
// This schema describes the exact shape of the object we expect from the Twitter API.
// Using literals for fixed string values like "bearer" and numbers like 7200 provides strong validation.
const TwitterTokenResponseSchema = Schema.Struct({
  token_type: Schema.Literal("bearer"),
  expires_in: Schema.Number,
  access_token: Schema.String,
  scope: Schema.String,
});

// We can also infer the type from the schema for full type safety.
type TwitterTokenResponse = Schema.Schema.Type<
  typeof TwitterTokenResponseSchema
>;

const makeRequest = (url: string | URL) =>
  Effect.gen(function* () {
    // Access HttpClient
    const client = yield* HttpClient.HttpClient;

    const id = yield* TWITTER_CLIENT_ID;
    const secret = yield* TWITTER_CLIENT_SECRET;

    // Create a GET request and set the Authorization header
    const req = HttpClientRequest.post(url).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Basic ${basicAuthToken(id, Redacted.value(secret))}`
      )
    );

    // Create and execute a GET request
    const response = yield* client.execute(req);
    yield* Console.log(`received response ${JSON.stringify(response)}`);

    const json = yield* response.json;
    yield* Console.log(`received json ${json}`);

    const tokenResponse = yield* Schema.decodeUnknown(
      TwitterTokenResponseSchema
    )(json);
    return tokenResponse;
  }).pipe(
    // Provide the HttpClient
    Effect.provide(FetchHttpClient.layer)
  );

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    HttpServerResponse.text(token === "" ? "index.html" : token)
  ),
  HttpRouter.get(
    "/oauth/twitter",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      Effect.gen(function* (_) {
        const { state, code } = getAuthParams(
          "http://localhost:3000" + request.url
        );

        if (state === undefined || code === undefined) {
          throw new ParseError({ message: "query parse error" });
        }

        // Use a proper Effect for getting config values.
        const client_id = yield* TWITTER_CLIENT_ID; // In a real app, this would be `yield* _(Config.string("TWITTER_CLIENT_ID"));`

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
        // This is the key change: `makeTokenRequest` returns an Effect,
        // so we can use `yield* _()` to safely execute it and get the result.
        const tokenResponse = yield* _(makeRequest(authRequest));

        // Use the token for subsequent operations (e.g., store in a database)
        // Note: Avoid side effects like direct variable assignment
        // `token = tokenResponse.access_token` is an anti-pattern.
        // Instead, compose further Effects. For example, an Effect that stores the token.
        yield* _(
          Console.log(`Received access token: ${tokenResponse.access_token}`)
        );

        // Return an Effect that performs the redirect.
        return HttpServerResponse.redirect("/");
      }).pipe(
        // The catchAll block now correctly handles any errors from the
        // entire generator effect.
        Effect.catchTags({
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

listen(app, 3000);
