import type { HttpPlatform, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Cron, Effect, Fiber, Layer, Schedule } from "effect";

export const listen = (
  app: Layer.Layer<
    never,
    never,
    HttpPlatform.HttpPlatform | HttpServer.HttpServer
  >,
  port: number
) => Layer.launch(Layer.provide(app, BunHttpServer.layer({ port })));

/**
 * this is the cron example job needs to be adjusted later with the db and
 * stuff then the composition of the layers happens in this function
 */
export const cron = () => {
  const cron = Cron.unsafeParse("*/10 * * * * *");
  const schedule = Schedule.cron(cron);
  const log = Effect.log("hello from cron");
  return Effect.repeat(log, schedule);
};

export const main = (
  listen: Effect.Effect<never, never, never>,
  cron: Effect.Effect<[number, number], never, never>
) => {
  const program = Effect.gen(function* () {
    const server = yield* Effect.fork(listen);
    const cronJob = yield* Effect.fork(cron);
    const both = Fiber.zip(server, cronJob)
    yield* Fiber.await(both);
  });
  BunRuntime.runMain(program);
};
