import type { HttpPlatform, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Fiber, Layer } from "effect";
import { ProgressService } from "./Services.js";

export const listen = (
  app: Layer.Layer<
    never,
    never,
    HttpPlatform.HttpPlatform | HttpServer.HttpServer
  >,
  port: number
) => Layer.launch(Layer.provide(app, BunHttpServer.layer({ port })));

export const main = (
  listen: Effect.Effect<never, never, never>,
  progress: Effect.Effect<[number, number], never, ProgressService>
) => {
  const program = Effect.gen(function* () {
    const server = yield* Effect.fork(listen);
    const cronJob = yield* Effect.fork(progress);
    const both = Fiber.zip(server, cronJob);
    yield* Fiber.await(both);
  }).pipe(Effect.provide(ProgressService.Default));
  BunRuntime.runMain(program);
};
