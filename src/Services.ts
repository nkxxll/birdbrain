import { HashMap, Ref, Effect, Config, ConfigError, Option } from "effect";
import { TwitterTokenResponse } from "./Models.js";
import { Database, SQLQueryBindings } from "bun:sqlite";

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
