import { Effect, Schedule } from "effect";
import { randomBytes } from "crypto";

export function generateRandomBytes(
  length: number = 64
): Effect.Effect<Buffer, never, never> {
  // We use `Effect.async<A, E, R>` to wrap a Node.js callback-based function.
  // The `resume` function is called with either a success or a failure.
  return Effect.async((resume) => {
    randomBytes(length, (err, buf) => {
      if (err) {
        // This is a critical, unrecoverable failure. A lack of entropy
        // or a crypto engine failure means the environment is compromised.
        // We use `resume(Effect.die(...))` to signal this fatal error.
        resume(
          Effect.die(
            new Error("Cryptographic random bytes generation failed.", {
              cause: err,
            })
          )
        );
      } else {
        // The operation was successful.
        // We use `resume(Effect.succeed(...))` to return the result.
        resume(Effect.succeed(buf));
      }
    });
  });
}
