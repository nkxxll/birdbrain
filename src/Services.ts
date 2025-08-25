import { HashMap, Ref, Effect, Config, ConfigError, Context } from "effect";
import { TwitterTokenResponse } from "./Models.js";
import { Database, SQLQueryBindings } from "bun:sqlite";
import { HttpLayerRouter } from "@effect/platform";

export class SessionStore extends Effect.Service<SessionStore>()(
  "SessionStore",
  {
    effect: Ref.make(HashMap.empty<string, TwitterTokenResponse>()),
  }
) {}

export class SQLiteService extends Effect.Service<SQLiteService>()(
  "SQLiteService",
  {
    effect: Effect.gen(function* () {
      const db = new Database("local.sqlite");

      return {
        exec: (sql: string, params?: SQLQueryBindings[]) =>
          Effect.try({
            try: () => db.run(sql, params || []),
            catch: (e: unknown) =>
              new Error("Database exec failed", { cause: e }),
          }),

        query: (sql: string, params?: SQLQueryBindings[]) =>
          Effect.try({
            try: () => db.prepare(sql).all(...(params || [])),
            catch: (e: unknown) =>
              new Error(`Database query failed`, { cause: e }),
          }),
      };
    }),
  }
) {}

export class AppConfig extends Effect.Service<AppConfig>()("AppConfig", {
  effect: Effect.gen(function* () {
    const clientSecret = yield* Config.redacted(
      Config.string("TWITTER_CLIENT_SECRET")
    );
    const clientId = yield* Config.string("TWITTER_CLIENT_ID");
    const appUrl = yield* Config.string("APP_URL");
    return {
      clientSecret,
      clientId,
      appUrl,
    };
  }).pipe(
    Effect.catchTag(
      "ConfigError",
      (e: ConfigError.ConfigError) =>
        Effect.die(
          "You have to provide the app config in and .env file or in the environment! Error: " +
            String(e)
        ) // die here because we cannot recover from missing config
    )
  ),
}) {}

// TODO
export class CryptoService extends Effect.Service<CryptoService>()(
  "CryptoService",
  {
    succeed: Effect.gen(function* () {
      return "todo";
    }),
  }
) {}

// https://github.com/Effect-TS/effect/blob/main/packages/platform/README.md#applying-middleware
// Here is a service that we want to provide to every HTTP request
class CurrentSession extends Context.Tag("CurrentSession")<
  CurrentSession,
  {
    readonly token: string;
  }
>() {}

// Using the `HttpLayerRouter.middleware` function, we can create a middleware
// that provides the `CurrentSession` service to every HTTP request.
export const SessionMiddleware = HttpLayerRouter.middleware<{
  provides: CurrentSession;
}>()(
  Effect.gen(function* () {
    yield* Effect.log("SessionMiddleware initialized");

    return (httpEffect) =>
      Effect.provideService(httpEffect, CurrentSession, {
        token: "dummy-token",
      });
  })
);
