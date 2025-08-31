import {
  FetchHttpClient,
  type HttpClient,
  type HttpPlatform,
  type HttpServer,
} from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Fiber, Layer } from "effect";
import {
  AppConfig,
  ProgressService,
  SessionStore,
  SQLiteService,
} from "./Services.js";

export const listen = (
  app: Layer.Layer<
    never,
    never,
    | HttpPlatform.HttpPlatform
    | HttpServer.HttpServer
    | ProgressService
    | HttpClient.HttpClient
    | SQLiteService
    | SessionStore
    | AppConfig
  >,
  port: number
) => Layer.launch(Layer.provide(app, BunHttpServer.layer({ port })));

const mainDeps = Layer.mergeAll(
  ProgressService.Default,
  SessionStore.Default,
  SQLiteService.Default,
  AppConfig.Default,
  FetchHttpClient.layer
);

export const main = (
  listen: Effect.Effect<
    never,
    never,
    | ProgressService
    | HttpClient.HttpClient
    | SQLiteService
    | SessionStore
    | AppConfig
  >,
  progress: Effect.Effect<
    void,
    never,
    | ProgressService
    | HttpClient.HttpClient
    | SQLiteService
    | AppConfig
    | SessionStore
  >
) => {
  const program = Effect.gen(function* () {
    const server = yield* Effect.fork(listen);
    const cronJob = yield* Effect.fork(progress);
    const both = Fiber.zip(server, cronJob);
    yield* Fiber.await(both);
  }).pipe(Effect.provide(mainDeps));
  BunRuntime.runMain(program);
};
