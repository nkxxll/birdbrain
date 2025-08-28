import {
  HashMap,
  Ref,
  Effect,
  Config,
  ConfigError,
  Context,
  Option,
} from "effect";
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

/**
 * Temporary store for the state: key and the value: verifier for the oauth flow
 * Only used in "/login" and "/oauth/twitter" route
 */
export class WebSocketService extends Effect.Service<WebSocketService>()(
  "WebSocketService",
  {
    effect: Effect.gen(function* () {
      const sessionStore = yield* SessionStore;
      const kv = yield* Ref.get(sessionStore);
      const server = Bun.serve<{ sessionId: string }, {}>({
        fetch(req, server) {
          const cookies = new Bun.CookieMap(req.headers.get("cookie")!);
          const sessionId = cookies.get("sessionId");
          if (sessionId === null) {
            return new Response("authentication required", { status: 401 });
          }
          const ssi = HashMap.get(kv, sessionId);
          if (Option.isNone(ssi)) {
            return new Response("authentication required", { status: 401 });
          }
          if (
            server.upgrade(req, {
              data: {
                sessionId,
              },
            })
          ) {
            return;
          }

          return new Response("Could not upgrade to ws", {
            status: 500,
          });
        },
        websocket: {
          open(ws) {
            ws.subscribe(ws.data.sessionId);
          },
          message() {},
          close() {},
        },
      });

      const publish = (message: string, sessionId: string) =>
        Effect.gen(function* () {
          const bytes = server.publish(sessionId, message);
          if (bytes === 0 || bytes === -1) {
            yield* Effect.logWarning("Websocket message could not be sent");
          }
        });

      return {
        publish,
      };
    }),
  }
) {}

export class ProgressService extends Effect.Service<ProgressService>()(
  "ProgressService",
  {
    effect: Effect.gen(function* () {
      const progress = yield* Ref.make(0);
      const updateProgress = () =>
        Effect.gen(function* () {
          yield* Ref.update(progress, (current) => (current + 10) % 100);
          const currentProgress = yield* Ref.get(progress);
          return currentProgress;
        });
      const getProgress = () =>
        Effect.gen(function* () {
          const currentProgress = yield* Ref.get(progress);
          return currentProgress;
        });
      return {
        updateProgress,
        getProgress,
      };
    }),
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
