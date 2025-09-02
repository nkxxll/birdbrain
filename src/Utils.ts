import { Effect, Schema, Option, Ref, HashMap, Redacted } from "effect";
import { randomBytes } from "crypto";
import { AppConfig, SessionStore, SQLiteService } from "./Services.js";
import {
  ApiPostResponse,
  ApiTweetPostRequest,
  NoPostLeftError,
  Post,
  RefreshError,
  SessionTokenNotFound,
  TwitterTokenResponseSchema,
  UserData,
} from "./Models.js";
import {
  FetchHttpClient,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpServerResponse,
  Url,
  UrlParams,
} from "@effect/platform";
import {
  TWITTER_OAUTH_TOKEN_URL,
  TWITTER_TWEET_MANAGE_URL,
  TWITTER_USER_ME_URL,
} from "./Contants.js";
import { post } from "@effect/platform/HttpClientRequest";

export function generateRandomBytes(
  length: number = 64
): Effect.Effect<Buffer, never, never> {
  return Effect.async((resume) => {
    randomBytes(length, (err, buf) => {
      if (err) {
        resume(
          Effect.die(
            new Error("Cryptographic random bytes generation failed.", {
              cause: err,
            })
          )
        );
      } else {
        resume(Effect.succeed(buf));
      }
    });
  });
}

export const sendRandomPost = (sessionId: string) =>
  Effect.gen(function* () {
    const sessionStore = yield* SessionStore;
    const db = yield* SQLiteService;
    const kv = yield* Ref.get(sessionStore);
    const ssi = HashMap.get(kv, sessionId);

    if (Option.isNone(ssi)) {
      return yield* Effect.fail(
        new SessionTokenNotFound({
          message: "Session store item for this session id should be found",
        })
      );
    }

    const sql = `SELECT * FROM posts WHERE user_id = ?1 AND was_sent = 0 ORDER BY RANDOM() LIMIT 1`;
    const [tweetUnknown] = yield* db.query(sql, [ssi.value.userId]);

    if (tweetUnknown === undefined) {
      return yield* Effect.fail(
        new NoPostLeftError({
          message: "There is no random post left to post",
        })
      );
    }

    const tweet = yield* Schema.decodeUnknown(Post)(tweetUnknown);

    const res = yield* makeTweetPostRequest(
      { text: tweet.content },
      sessionId,
      ssi.value.tokenResponse.access_token
    );

    yield* Effect.log("The post was sent");

    yield* setSent(tweet.id);

    yield* Effect.log("the post was set to sent");

    const postRes = yield* Schema.decodeUnknown(ApiPostResponse)(res);

    yield* Effect.log("we have a post response");

    return postRes;
  });

export const makeTweetPostRequest = (
  request: ApiTweetPostRequest,
  sessionId: string,
  accessToken: string
) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const body = {
      text: request.text,
    };

    const req = HttpClientRequest.post(TWITTER_TWEET_MANAGE_URL).pipe(
      HttpClientRequest.bearerToken(accessToken),
      HttpClientRequest.setBody(yield* HttpBody.json(body))
    );
    let postResponse = yield* client.execute(req);

    if (postResponse.status !== 201) {
      yield* Effect.log("Try to refresh token");
      const accessToken = yield* refreshAuthToken(sessionId);
      const req = HttpClientRequest.post(TWITTER_TWEET_MANAGE_URL).pipe(
        HttpClientRequest.bearerToken(accessToken),
        HttpClientRequest.setBody(
          HttpBody.text(JSON.stringify(body), "application/json")
        )
      );
      postResponse = yield* client.execute(req);
      if (postResponse.status !== 201) {
        const json = yield* postResponse.json;
        return yield* HttpServerResponse.json(json, {
          status: postResponse.status,
        });
      }
    }

    const jsonResUnknown = yield* postResponse.json;

    const jsonRes = yield* Schema.decodeUnknown(ApiPostResponse)(
      jsonResUnknown
    );

    yield* Effect.logInfo(`Post sent successfully response: ${jsonRes}`);

    return yield* HttpClientResponse.schemaBodyJson(ApiPostResponse)(
      postResponse
    );
  });

export function refreshAuthToken(sessionId: string) {
  return Effect.gen(function* () {
    const sessionStore = yield* SessionStore;
    const kv = yield* Ref.get(sessionStore);
    const ssi = HashMap.get(kv, sessionId);
    const config = yield* AppConfig;

    if (Option.isNone(ssi)) {
      return yield* Effect.fail(
        new RefreshError({ message: "session store item should be found" })
      );
    }

    const authRequest = Url.setUrlParams(
      new URL(TWITTER_OAUTH_TOKEN_URL),
      UrlParams.fromInput([
        ["refresh_token", ssi.value.tokenResponse.refresh_token],
        ["client_id", config.clientId],
        ["grant_type", "refresh_token"],
      ])
    );
    const newTokenResponse = yield* makeAuthRequest(authRequest);
    yield* Ref.update(
      sessionStore,
      HashMap.set(sessionId, {
        ...ssi.value,
        tokenResponse: newTokenResponse,
      })
    );

    return newTokenResponse.access_token;
  });
}

export function getAuthParams(url: string): {
  state: string | undefined;
  code: string | undefined;
} {
  const params = new URL(url).searchParams;

  return {
    state: params.get("state") ?? undefined,
    code: params.get("code") ?? undefined,
  };
}

export const setSent = (postId: number) =>
  Effect.gen(function* () {
    const db = yield* SQLiteService;
    const sql = `UPDATE posts SET was_sent = 1 WHERE id = ?1;`;

    const res = yield* db.exec(sql, [postId]);
    yield* Effect.log(
      `Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`
    );
  });

export const makeUserDataRequest = (authToken: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const req = HttpClientRequest.get(TWITTER_USER_ME_URL).pipe(
      HttpClientRequest.bearerToken(authToken)
    );
    const postResponse = yield* client.execute(req);

    return yield* postResponse.json;
  });

export const makeAuthRequest = (url: string | URL) =>
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

export const savePost = (userId: string, text: string) =>
  Effect.gen(function* () {
    const db = yield* SQLiteService;
    const sql = `INSERT OR IGNORE INTO posts (user_id, content) VALUES (?1, ?2);`;

    const res = yield* db.exec(sql, [userId, text]);
    yield* Effect.log(
      `Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`
    );
    return res;
  });

export const makeUser = (userData: UserData) =>
  Effect.gen(function* () {
    const db = yield* SQLiteService;
    const sql = `INSERT OR IGNORE INTO users (id, username, name) VALUES (?1, ?2, ?3);`;

    const res = yield* db.exec(sql, [
      userData.id,
      userData.username,
      userData.name,
    ]);
    yield* Effect.log(
      `Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`
    );
  });

export const queryPosts = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* SQLiteService;
    const sql = `SELECT * FROM posts WHERE user_id = ?1;`;
    const res = yield* db.query(sql, [userId]);
    return res;
  });

export const queryUserData = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* SQLiteService;
    const sql = `SELECT * FROM users WHERE id = ?1;`;
    const [res] = yield* db.query(sql, [userId]);
    return res;
  });
