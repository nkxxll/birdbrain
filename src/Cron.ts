import { Cron, Effect, HashMap, Ref, Schedule, Option } from "effect";
import { ProgressService } from "./Services.js";
import { sendRandomPost } from "./Utils.js";

export class ProgressLayer extends Effect.Service<ProgressLayer>()(
  "ProgressLayer",
  {
    effect: Effect.gen(function* () {
      yield* Effect.log("Starting cron...");
      const sendProgress = Effect.gen(function* () {
        yield* Effect.log("[Cron]: Step itteration...");
        const ps = yield* ProgressService;
        const kv = yield* Ref.get(ps);
        for (const key of HashMap.keys(kv)) {
          const value = HashMap.get(kv, key);
          if (Option.isNone(value)) {
            yield* Effect.logWarning(
              "Itterating through keys but the value is not there this should never happen!"
            );
            continue;
          }
          const newVal = (value.value + 10) % 100;
          yield* Ref.update(ps, HashMap.set(key, newVal));
          yield* Effect.log(`updateing progress to key: ${key} val:${newVal}`);
          if (newVal === 0) {
            yield* Effect.log("Sending message!");
            const res = yield* sendRandomPost(key);
            yield* Effect.log("Response from server " + JSON.stringify(res));
            yield* Effect.log("Sent message!");
          }
        }
        return yield* Effect.void;
      });

      const cron = Cron.unsafeParse("*/6 * * * * *");
      const schedule = Schedule.cron(cron);
      return yield* Effect.repeat(sendProgress, schedule);
    }),
  }
) {}
