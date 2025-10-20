import { Cron, Effect, HashMap, Ref, Schedule, Option } from "effect";
import { ProgressService } from "./Services.js";
import { sendRandomPost } from "./Utils.js";

export class ProgressLayer extends Effect.Service<ProgressLayer>()(
  "ProgressLayer",
  {
    effect: Effect.gen(function* () {
      yield* Effect.log("Starting cron...");
      const sendProgress = Effect.gen(function* () {
        yield* Effect.log("Step itteration...");
        const ps = yield* ProgressService;
        const kv = yield* Ref.get(ps);
        for (const userId of HashMap.keys(kv)) {
          const progressItemOption = HashMap.get(kv, userId);
          if (Option.isNone(progressItemOption)) {
            yield* Effect.logWarning(
              "Itterating through keys but the value is not there this should never happen!"
            );
            continue;
          }
          // all 6 mins we increase by 5 so every 2h we trigger
          const newVal = (progressItemOption.value.progress + 5) % 100;
          yield* Ref.update(
            ps,
            HashMap.set(userId, {
              ...progressItemOption.value,
              progress: newVal,
            })
          );
          yield* Effect.log(
            `updateing progress to key: ${userId} val:${newVal}`
          );
          if (newVal === 0) {
            yield* Effect.log("Sending message!");
            const res = yield* sendRandomPost(
              progressItemOption.value.sessionId
            );
            yield* Effect.log("Response from server " + JSON.stringify(res));
            yield* Effect.log("Sent message!");
          }
        }
        return yield* Effect.void;
      });

      const cron = Cron.unsafeParse("*/6 * * * *");
      // const cron = Cron.unsafeParse("*/6 * * * * *"); // every 6 secs for testing
      const schedule = Schedule.cron(cron);
      return yield* Effect.repeat(sendProgress, schedule);
    }),
  }
) {}
