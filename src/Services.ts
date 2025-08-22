import { Context, HashMap, Layer, Ref, Effect } from "effect";
import { TwitterTokenResponse } from "./Models.js";
import { Changes, Database, SQLQueryBindings } from "bun:sqlite";

export interface SessionStore {
  sessions: Ref.Ref<HashMap.HashMap<string, TwitterTokenResponse>>;
}

export class SessionStoreTag extends Context.Tag("SessionStore")<
  SessionStoreTag,
  Ref.Ref<HashMap.HashMap<string, TwitterTokenResponse>>
>() {}

export const SessionStoreLive = Layer.effect(
  SessionStoreTag,
  Ref.make(HashMap.empty<string, TwitterTokenResponse>())
);

export class SQLiteService extends Context.Tag("SQLiteService")<
  SQLiteService,
  {
    readonly query: (
      sql: string,
      params?: SQLQueryBindings[]
    ) => Effect.Effect<unknown[], Error, never>;

    readonly exec: (
      sql: string,
      params?: SQLQueryBindings[]
    ) => Effect.Effect<Changes, Error, never>;
  }
>() {}

export const SQLiteLive = Layer.effect(
  SQLiteService,
  Effect.gen(function* () {
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
  })
);
