import { HashMap, Ref, Effect } from "effect";
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
