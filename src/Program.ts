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
import { Schema, Config, Effect, Redacted } from "effect";

const TWITTER_OAUTH_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const TWITTER_CLIENT_SECRET = Config.redacted(
  Config.string("TWITTER_CLIENT_SECRET")
);
const TWITTER_CLIENT_ID = Config.string("TWITTER_CLIENT_ID");
const CONFIG_APP_URL = Config.string("APP_URL");

const basicAuthToken = (id: string, secret: string) =>
  Buffer.from(`${id}:${secret}`, "utf8").toString("base64");

let token = "";

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
    const req = HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Basic ${basicAuthToken(id, Redacted.value(secret))}`
      )
    );

    // Create and execute a GET request
    const response = yield* client.execute(req);
    const json = yield* response.json;
    const tokenResponse = Schema.decodeUnknownSync(TwitterTokenResponseSchema)(
      json
    );
    return tokenResponse;
  }).pipe(
    // Provide the HttpClient
    Effect.provide(FetchHttpClient.layer)
  );

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("index.html")),
  HttpRouter.get(
    "/oauth/twitter",
    Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.runSync(
        Effect.gen(function* () {
          const code = yield* req.urlParamsBody.pipe(
            Effect.flatMap(UrlParams.getFirst("code"))
          );
          const client_id = yield* TWITTER_CLIENT_ID;
          const authRequest = Url.setUrlParams(
            new URL(TWITTER_OAUTH_TOKEN_URL),
            UrlParams.fromInput([
              ["code", code],
              ["client_id", client_id],
              ["code_verifier", "8KxxO-RPl0bLSxX5AWwgdiFbMnry_VOKzFeIlVA7NoA"],
              ["redirect_uri", `http://www.localhost:3001/oauth/twitter`],
              ["grant_type", "authorization_code"],
            ])
          );
          const response = yield* makeRequest(authRequest);
          // bad bad side effect
          token = response.access_token;
          const app_url = yield* CONFIG_APP_URL;
          return HttpServerResponse.redirect(app_url);
        }).pipe(
          Effect.catchTags({
            ConfigError: (err) =>
              HttpServerResponse.text(`Config error: ${err.message}`, {
                status: 500,
              }),
            RequestError: (err) =>
              HttpServerResponse.text(`Request error: ${err.message}`, {
                status: 500,
              }),
            NoSuchElementException: (err) =>
              HttpServerResponse.text(
                `No such element exception: ${err.message}`,
                { status: 500 }
              ),
          })
        )
      )
    )
  ),
  HttpRouter.get(
    "/login",
    Effect.runSync(
      composed.pipe(
        Effect.catchTags({
          ConfigError: (err) =>
            HttpServerResponse.text(`Config error: ${err}`, { status: 500 }),
        })
      )
    )
  )
);

const app = router.pipe(HttpServer.serve(HttpMiddleware.logger));

listen(app, 3000);
