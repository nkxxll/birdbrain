import { Effect, HashMap, HashSet, Option, Ref } from "effect";
import {
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { SessionStore, SessionStoreItemService } from "./Services.js";
import { SessionTokenNotFound } from "./Models.js";

export const SessionTokenMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const sessionId = Option.fromNullable(req.cookies["sessionId"]);
    const sessionStore = yield* SessionStore;
    const kv = yield* Ref.get(sessionStore);

    if (Option.isNone(sessionId)) {
      return yield* Effect.fail(new SessionTokenNotFound({}));
    }

    if (!HashSet.has(HashMap.keySet(kv), sessionId.value)) {
      return yield* Effect.fail(new SessionTokenNotFound({}));
    }

    const ssi = yield* HashMap.get(kv, sessionId.value)

    return yield* app.pipe(
      Effect.provideService(SessionStoreItemService, ssi)
    );
  }).pipe(
    Effect.catchTag("SessionTokenNotFound", () =>
      HttpServerResponse.text("Session Not Logged In", { status: 401 })
    )
  )
);
