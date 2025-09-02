import {
  HttpRouter,
  HttpServer,
  HttpServerResponse,
  HttpMiddleware,
  HttpServerRequest,
  UrlParams,
  Url,
} from "@effect/platform";
import { listen, main } from "./Compose.js";
import { ProgressLayer } from "./Cron.js";
import { Logger, Option, Schema, Effect, Layer, Ref, HashMap } from "effect";
import {
  ApiTweetPostRequest,
  ApiUserDataResponse,
  DeleteParams,
  NoPostLeftError,
  RefreshError,
  SessionTokenNotFound,
  TwitterTokenResponseSchema,
} from "./Models.js";
import {
  AppConfig,
  ProgressService,
  SessionStore,
  SessionStoreItemService,
  SQLiteService,
  VerifierStore,
} from "./Services.js";
import {
  generateRandomBytes,
  getAuthParams,
  makeAuthRequest,
  makeTweetPostRequest,
  makeUser,
  makeUserDataRequest,
  queryPosts,
  queryUserData,
  refreshAuthToken,
  savePost,
  sendRandomPost,
  setSent,
} from "./Utils.js";
import { SessionTokenMiddleware } from "./Middleware.js";
import { TWITTER_OAUTH_TOKEN_URL } from "./Contants.js";
import { RequestError, ResponseError } from "@effect/platform/HttpClientError";
import { ParseError } from "effect/ParseResult";

const sessionCookieDefaults = {
  path: "/", // available everywhere
  httpOnly: true, // not accessible to JS (XSS protection)
  secure: true, // only sent over HTTPS
  sameSite: "lax" as const, // CSRF protection but still works for most logins
  priority: "high" as const, // browsers send this cookie earlier under pressure
};

const authenticatedRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/refresh",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const sessionIdOption = Option.fromNullable(req.cookies["sessionId"]);
      if (Option.isNone(sessionIdOption)) {
        return HttpServerResponse.text(
          "should not happen should be logged in",
          { status: 500 }
        );
      }

      const res = yield* makeTweetPostRequest(
        { text: "But if it works it is just one of the best feelings in the world!!!" },
        sessionIdOption.value,
        "hahaha this accestoken is trash"
      );

      return HttpServerResponse.text(JSON.stringify(res));
    })
  ),
  HttpRouter.del(
    "/delete/:id",
    Effect.gen(function* () {
      const ssi = yield* SessionStoreItemService;
      const db = yield* SQLiteService;
      const params = yield* HttpRouter.schemaPathParams(DeleteParams);

      const sql = `DELETE FROM posts WHERE user_id = ?1 AND id = ?2`;
      const res = yield* db.exec(sql, [ssi.userId, params.id]);
      yield* Effect.log(res);
      return HttpServerResponse.text("Deleted Successfully!", { status: 201 });
    })
  ),
  HttpRouter.get(
    "/sendrandom",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const sessionId = Option.fromNullable(req.cookies["sessionId"]);
      if (Option.isNone(sessionId)) {
        return HttpServerResponse.text("should be here", { status: 500 });
      }
      const postRes = yield* sendRandomPost(sessionId.value);

      return yield* HttpServerResponse.json(postRes);
    })
  ),
  HttpRouter.get(
    "/pollprogress",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const sessionId = Option.fromNullable(req.cookies["sessionId"]);
      const ps = yield* ProgressService;
      if (Option.isNone(sessionId)) {
        return HttpServerResponse.text(
          "Server error session id should be here",
          { status: 500 }
        );
      }

      const kv = yield* Ref.get(ps);
      yield* Effect.log(kv);
      const progress = HashMap.get(kv, sessionId.value);
      if (Option.isNone(progress)) {
        return HttpServerResponse.text(
          "Progress should be present here because you are logged in!",
          { status: 500 }
        );
      }

      return yield* HttpServerResponse.json({ progress: progress.value });
    })
  ),
  HttpRouter.get(
    "/logout",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const sessions = yield* SessionStore;
      const sessionId = Option.fromNullable(req.cookies["sessionId"]);
      const config = yield* AppConfig;
      if (Option.isNone(sessionId)) {
        return HttpServerResponse.text(
          "Server error session id should be here (logout)",
          { status: 500 }
        );
      }
      yield* Ref.update(sessions, HashMap.remove(sessionId.value));
      return HttpServerResponse.redirect(`${config.appUrl}/logout`);
    })
  ),
  HttpRouter.get(
    "/myuser",
    Effect.gen(function* () {
      const ssi = yield* SessionStoreItemService;

      const json = yield* queryUserData(ssi.userId);

      return yield* HttpServerResponse.json(json);
    })
  ),
  HttpRouter.get(
    "/posts",
    Effect.gen(function* () {
      const ssi = yield* SessionStoreItemService;

      const posts = yield* queryPosts(ssi.userId);
      return yield* HttpServerResponse.json(posts);
    })
  ),
  HttpRouter.post(
    "/savepost",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        const ssi = yield* SessionStoreItemService;
        const json = yield* req.json;

        const request: ApiTweetPostRequest = yield* Schema.decodeUnknown(
          ApiTweetPostRequest
        )(json);

        yield* savePost(ssi.userId, request.text);
        return HttpServerResponse.text("Successfully saved!", { status: 201 });
      })
    )
  ),
  HttpRouter.post(
    "/tweet",
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
      Effect.gen(function* () {
        const ssi = yield* SessionStoreItemService;
        const json = yield* req.json;

        const sessionId = Option.fromNullable(req.cookies["sessionId"]);

        if (Option.isNone(sessionId)) {
          return HttpServerResponse.text(
            "The session id has to be set at this point",
            { status: 500 }
          );
        }

        yield* Effect.log(`Json from the client:\n${JSON.stringify(json)}`);
        const request: ApiTweetPostRequest = yield* Schema.decodeUnknown(
          ApiTweetPostRequest
        )(json);

        let id = request.id;
        if (!request.id) {
          const res = yield* savePost(ssi.userId, request.text);
          id = res.lastInsertRowid as number;
        }

        const apiResponse = yield* makeTweetPostRequest(
          request,
          sessionId.value,
          ssi.tokenResponse.access_token
        );

        if (request.id) {
          yield* setSent(request.id);
        } else {
          yield* setSent(id!);
        }

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
        const ssi = HashMap.get(kv, sessionId.value);

        return HttpServerResponse.text(
          JSON.stringify(
            Option.isNone(ssi)
              ? "no token res for this ession"
              : Schema.encodeSync(TwitterTokenResponseSchema)(
                  ssi.value.tokenResponse
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
        const sessionStore = yield* SessionStore;
        const verifierStore = yield* VerifierStore;
        const psRef = yield* ProgressService;
        const ps = yield* Ref.get(psRef);
        const vs = yield* Ref.get(verifierStore);

        const { state, code } = getAuthParams(
          "http://localhost:3000" + request.url
        );

        if (state === undefined || code === undefined) {
          return yield* Effect.fail(
            new Error("could not parse request parameters")
          );
        }

        const baseVerifierOption = HashMap.get(vs, state);

        if (Option.isNone(baseVerifierOption)) {
          return HttpServerResponse.text(
            "State and verifier could not be found in the verifier store!",
            { status: 500 }
          );
        }

        const verifier = baseVerifierOption.value;

        const authRequest = Url.setUrlParams(
          new URL(TWITTER_OAUTH_TOKEN_URL),
          UrlParams.fromInput([
            ["code", code],
            ["client_id", config.clientId],
            ["code_verifier", verifier],
            ["redirect_uri", config.redirectUrl],
            ["grant_type", "authorization_code"],
          ])
        );

        // Note: important remove the unique throw away verifier immediately
        yield* Ref.update(verifierStore, HashMap.remove(state));

        const tokenResponse = yield* makeAuthRequest(authRequest);

        const random = yield* generateRandomBytes();
        const sessionId = random.toString("base64");

        // create the user in the database if the user does not exist
        const userRes = yield* makeUserDataRequest(tokenResponse.access_token);
        yield* Effect.log(JSON.stringify(userRes));
        const data = yield* Schema.decodeUnknown(ApiUserDataResponse)(userRes);
        if (data.errors) {
          return yield* HttpServerResponse.json(data.errors, { status: 500 });
        }
        if (!data.data) {
          return HttpServerResponse.text(
            "Data from user request is not there!",
            { status: 500 }
          );
        }

        const user = data.data!;

        yield* makeUser(user);
        yield* Ref.update(
          sessionStore,
          HashMap.set(sessionId, {
            userId: user.id,
            tokenResponse,
          })
        );
        // see if the user already has logged in
        const progressItem = HashMap.get(ps, user.id);
        if (Option.isNone(progressItem)) {
          yield* Ref.update(
            psRef,
            HashMap.set(user.id, { progress: 0, sessionId: sessionId })
          );
        } else {
          yield* Ref.update(
            psRef,
            HashMap.set(user.id, {
              progress: progressItem.value.progress,
              sessionId: sessionId,
            })
          );
        }

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
      const verifierStore = yield* VerifierStore;

      const randomState = yield* generateRandomBytes();
      const state = randomState.toString("base64");

      const randomVerifier = yield* generateRandomBytes();
      const randomVerifierBase = randomVerifier.toString("base64");
      const challengeHash = yield* Effect.tryPromise({
        try: () =>
          crypto.subtle.digest("SHA-256", Buffer.from(randomVerifierBase)),
        catch: (err) =>
          new Error("Failed to create SHA-256 digest", { cause: err }),
      });
      const challenge = Buffer.from(challengeHash).toString("base64url");

      yield* Ref.update(verifierStore, HashMap.set(state, randomVerifierBase));

      const rootUrl = "https://twitter.com/i/oauth2/authorize";
      const options = {
        redirect_uri: config.redirectUrl,
        client_id: config.clientId,
        state,
        response_type: "code",
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope: [
          "users.email",
          "users.read",
          "tweet.write",
          "tweet.read",
          "follows.read",
          "follows.write",
          "offline.access",
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
  app.pipe(Layer.provide(VerifierStore.Default), Layer.provide(Logger.pretty)),
  3001
).pipe(Effect.annotateLogs({ scope: "server" }));

const cronEffect = Layer.launch(ProgressLayer.Default).pipe(
  Effect.catchTags({
    SessionTokenNotFound: (e: SessionTokenNotFound) =>
      Effect.logError(
        `Session token not found error: ${e.message}\nCause: ${e.cause}`
      ),
    RequestError: (e: RequestError) =>
      Effect.logError(
        `RequestError not found error: ${e.message}\nCause: ${e.cause}`
      ),
    ResponseError: (e: ResponseError) =>
      Effect.logError(
        `ResponseError not found error: ${e.message}\nCause: ${e.cause}`
      ),
    ParseError: (e: ParseError) =>
      Effect.logError(
        `ResponseError not found error: ${e.message}\nCause: ${e.cause}`
      ),
    RefreshError: (e: RefreshError) =>
      Effect.logError(`Error while refreshing ${e.message}\nCause: ${e.cause}`),
    NoPostLeftError: (e: NoPostLeftError) =>
      Effect.logWarning(`There is no post left to send message: ${e.message}`),
  }),
  Effect.annotateLogs({ scope: "cron" })
);

main(listenEffect, cronEffect);
