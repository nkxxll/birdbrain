import {
  HttpRouter,
  HttpServer,
  HttpServerResponse,
  HttpMiddleware,
  HttpServerRequest,
} from "@effect/platform";
import { listen } from "./Listen.js";
import { Config, Effect } from "effect";

const request_token_url = "https://api.twitter.com/oauth/request_token";
const callback_url = "http://localhost:3000/redirect";
const access_token_url = "https://api.twitter.com/oauth/access_token";
const authorize_url = "https://api.twitter.com/oauth/authorize";
const show_user_url = "https://api.twitter.com/1.1/users/show.json";

const twitter_client_id = Config.string("TWITTER_CLIENT_ID");

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
  const id = yield* twitter_client_id;
  const url = yield* redirect_to_auth(id);
  return HttpServerResponse.redirect(url.toString());
});

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("index.html")),
  HttpRouter.get(
    "/oauth/twitter",
    Effect.map(HttpServerRequest.HttpServerRequest, (req) =>
      HttpServerResponse.text(req.url)
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
