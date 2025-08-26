import { HashMap, Ref, Effect, Config, ConfigError, Context } from "effect";
import { DatabaseError, SessionStoreItem } from "./Models.js";
import { Database, SQLQueryBindings } from "bun:sqlite";

export class SessionStoreItemService extends Context.Tag(
  "SessionStoreItemService"
)<SessionStoreItemService, SessionStoreItem>() {}

export class SessionStore extends Effect.Service<SessionStore>()(
  "SessionStore",
  {
    effect: Ref.make(HashMap.empty<string, SessionStoreItem>()),
  }
) {}

/**
 * Temporary store for the state: key and the value: verifier for the oauth flow
 * Only used in "/login" and "/oauth/twitter" route
 */
export class VerifierStore extends Effect.Service<VerifierStore>()(
  "VerifierStore",
  {
    effect: Ref.make(HashMap.empty<string, string>()),
  }
) {}

export class SQLiteService extends Effect.Service<SQLiteService>()(
  "SQLiteService",
  {
    effect: Effect.gen(function* () {
      const db = new Database("local.sqlite");
      const exec = (sql: string, params?: SQLQueryBindings[]) =>
        Effect.try({
          try: () => db.run(sql, params || []),
          catch: (e: unknown) =>
            new DatabaseError({ message: "Database exec failed", cause: e }),
        });

      const query = (sql: string, params?: SQLQueryBindings[]) =>
        Effect.try({
          try: () => db.prepare(sql).all(...(params || [])),
          catch: (e: unknown) =>
            new DatabaseError({ message: "Database query failed", cause: e }),
        });
      return {
        exec,
        query,
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
    const redirectUrl = yield* Config.string("REDIRECT_URL");
    return {
      redirectUrl,
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
