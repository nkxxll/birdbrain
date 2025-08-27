import {
	HttpRouter,
	HttpServer,
	HttpServerResponse,
	HttpMiddleware,
	HttpServerRequest,
	UrlParams,
	Url,
	HttpClient,
	FetchHttpClient,
	HttpClientRequest,
	HttpBody,
	HttpClientResponse,
} from "@effect/platform";
import { listen, main, cron } from "./Compose.js";
import {
	Logger,
	Option,
	Schema,
	Effect,
	Redacted,
	Layer,
	Ref,
	HashMap,
} from "effect";
import { ParseError } from "effect/Cron";
import {
	ApiPostResponse,
	ApiTweetPostRequest,
	ApiUserDataResponse,
	RefreshError,
	TwitterTokenResponseSchema,
	UserData,
} from "./Models.js";
import {
	AppConfig,
	SessionStore,
	SessionStoreItemService,
	SQLiteService,
	VerifierStore,
} from "./Services.js";
import { generateRandomBytes } from "./Utils.js";
import { SessionTokenMiddleware } from "./Middleware.js";
import { Session } from "inspector";

const sessionCookieDefaults = {
	path: "/", // available everywhere
	httpOnly: true, // not accessible to JS (XSS protection)
	secure: true, // only sent over HTTPS
	sameSite: "lax" as const, // CSRF protection but still works for most logins
	priority: "high" as const, // browsers send this cookie earlier under pressure
};

const TWITTER_USER_ME_URL = "https://api.x.com/2/users/me";
const TWITTER_TWEET_MANAGE_URL = "https://api.x.com/2/tweets";
const TWITTER_OAUTH_TOKEN_URL = "https://api.x.com/2/oauth2/token";

function refreshAuthToken() {
	return Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const sessionStore = yield* SessionStore;
		const ssi = yield* SessionStoreItemService;
		const config = yield* AppConfig;
		const sessionId = Option.fromNullable(req.cookies["sessionId"]);

		if (Option.isNone(sessionId)) {
			throw new RefreshError({ message: "Session ID has to be here by now" });
		}

		const authRequest = Url.setUrlParams(
			new URL(TWITTER_OAUTH_TOKEN_URL),
			UrlParams.fromInput([
				["refresh_token", ssi.tokenResponse.refresh_token],
				["client_id", config.clientId],
				["grant_type", "authorization_code"],
			]),
		);
		const newTokenResponse = yield* makeAuthRequest(authRequest);
		yield* Ref.update(sessionStore, (current) =>
			HashMap.set(current, sessionId.value, {
				...ssi,
				tokenResponse: newTokenResponse,
			}),
		);

		return newTokenResponse.access_token;
	});
}

function getAuthParams(url: string): {
	state: string | undefined;
	code: string | undefined;
} {
	const params = new URL(url).searchParams;

	return {
		state: params.get("state") ?? undefined,
		code: params.get("code") ?? undefined,
	};
}

const setSent = (postId: number) =>
	Effect.gen(function* () {
		const { query, exec } = yield* SQLiteService;
		const sql = `UPDATE posts SET was_sent = 1 WHERE id = ?1;`;

		const res = yield* exec(sql, [postId]);
		yield* Effect.log(
			`Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`,
		);
	});

const makeTweetPostRequest = (
	request: ApiTweetPostRequest,
	accessToken: string,
) =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;

		const body = {
			text: request.text,
		};

		const req = HttpClientRequest.post(TWITTER_TWEET_MANAGE_URL).pipe(
			HttpClientRequest.bearerToken(accessToken),
			HttpClientRequest.setBody(
				HttpBody.text(JSON.stringify(body), "application/json"),
			),
		);
		const postResponse = yield* client.execute(req);

		return yield* HttpClientResponse.schemaBodyJson(ApiPostResponse)(
			postResponse,
		);
	});

const makeUserDataRequest = (authToken: string) =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;

		const req = HttpClientRequest.get(TWITTER_USER_ME_URL).pipe(
			HttpClientRequest.bearerToken(authToken),
		);
		const postResponse = yield* client.execute(req);

		return yield* postResponse.json;
	});

const makeAuthRequest = (url: string | URL) =>
	Effect.gen(function* () {
		const config = yield* AppConfig;
		const client = yield* HttpClient.HttpClient;

		const req = HttpClientRequest.post(url).pipe(
			HttpClientRequest.basicAuth(
				config.clientId,
				Redacted.value(config.clientSecret),
			),
		);

		const response = yield* client.execute(req);

		const json = yield* response.json;

		const tokenResponse = yield* Schema.decodeUnknown(
			TwitterTokenResponseSchema,
		)(json);
		return tokenResponse;
	}).pipe(Effect.provide(FetchHttpClient.layer));

const savePost = (userId: string, text: string) =>
	Effect.gen(function* () {
		const { query, exec } = yield* SQLiteService;
		const sql = `INSERT OR IGNORE INTO posts (user_id, content) VALUES (?1, ?2);`;

		const res = yield* exec(sql, [userId, text]);
		yield* Effect.log(
			`Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`,
		);
		return res;
	});

const makeUser = (userData: UserData) =>
	Effect.gen(function* () {
		const { query, exec } = yield* SQLiteService;
		const sql = `INSERT OR IGNORE INTO users (id, username, name) VALUES (?1, ?2, ?3);`;

		const res = yield* exec(sql, [
			userData.id,
			userData.username,
			userData.name,
		]);
		yield* Effect.log(
			`Changes to the database: ${res.changes}; Row id: ${res.lastInsertRowid}`,
		);
	});

const queryPosts = (userId: string) =>
	Effect.gen(function* () {
		const { query, exec } = yield* SQLiteService;
		const sql = `SELECT * FROM posts WHERE user_id = ?1;`;
		const res = yield* query(sql, [userId]);
		return res;
	});

const queryUserData = (userId: string) =>
	Effect.gen(function* () {
		const { query, exec } = yield* SQLiteService;
		const sql = `SELECT * FROM users WHERE id = ?1;`;
		const [res] = yield* query(sql, [userId]);
		return res;
	});

const authenticatedRouter = HttpRouter.empty.pipe(
	HttpRouter.get(
		"/refresh",
		Effect.gen(function* () {
			const newToken = yield* refreshAuthToken();
			return HttpServerResponse.text(newToken);
		}),
	),

	HttpRouter.get(
		"/myuser",
		Effect.gen(function* () {
			const ssi = yield* SessionStoreItemService;

			const json = yield* queryUserData(ssi.userId);

			return yield* HttpServerResponse.json(json);
		}),
	),
	HttpRouter.get(
		"/posts",
		Effect.gen(function* () {
			const ssi = yield* SessionStoreItemService;

			const posts = yield* queryPosts(ssi.userId);
			return yield* HttpServerResponse.json(posts);
		}),
	),
	HttpRouter.post(
		"/savepost",
		Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
			Effect.gen(function* () {
				const ssi = yield* SessionStoreItemService;
				const json = yield* req.json;

				const request: ApiTweetPostRequest =
					yield* Schema.decodeUnknown(ApiTweetPostRequest)(json);

				yield* savePost(ssi.userId, request.text);
				return HttpServerResponse.text("Successfully saved!", { status: 201 });
			}),
		),
	),
	HttpRouter.post(
		"/tweet",
		Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
			Effect.gen(function* () {
				const ssi = yield* SessionStoreItemService;
				const json = yield* req.json;

				yield* Effect.log(`Json from the client:\n${JSON.stringify(json)}`);
				const request: ApiTweetPostRequest =
					yield* Schema.decodeUnknown(ApiTweetPostRequest)(json);

				let id = request.id;
				if (!request.id) {
					const res = yield* savePost(ssi.userId, request.text);
					id = res.lastInsertRowid as number;
				}

				const apiResponse = yield* makeTweetPostRequest(
					request,
					ssi.tokenResponse.access_token,
				);

				if (request.id) {
					yield* setSent(request.id);
				} else {
					yield* setSent(id!);
				}

				return yield* HttpServerResponse.json(JSON.stringify(apiResponse));
			}),
		),
	),
	HttpRouter.use(SessionTokenMiddleware),
);

const router = HttpRouter.empty.pipe(
	HttpRouter.mount("/", authenticatedRouter),
	HttpRouter.get(
		"/",
		Effect.flatMap(HttpServerRequest.HttpServerRequest, (req) =>
			Effect.gen(function* () {
				const sessions = yield* SessionStore;
				const kv = yield* Ref.get(sessions);
				const sessionId = Option.fromNullable(req.cookies["sessionId"]);
				if (Option.isNone(sessionId)) {
					return HttpServerResponse.html(
						'no session id Welcome login buddy <a href="/login">login</a>',
					);
				}
				const ssi = HashMap.get(kv, sessionId.value);

				return HttpServerResponse.text(
					JSON.stringify(
						Option.isNone(ssi)
							? "no token res for this ession"
							: Schema.encodeSync(TwitterTokenResponseSchema)(
									ssi.value.tokenResponse,
								),
					),
				);
			}),
		),
	),
	HttpRouter.get(
		"/oauth/twitter",
		Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
			Effect.gen(function* () {
				const config = yield* AppConfig;
				const sessionStore = yield* SessionStore;
				const verifierStore = yield* VerifierStore;
				const vs = yield* Ref.get(verifierStore);

				const { state, code } = getAuthParams(
					"http://localhost:3000" + request.url,
				);

				if (state === undefined || code === undefined) {
					throw new ParseError({ message: "query parse error" });
				}

				const baseVerifierOption = HashMap.get(vs, state);

				if (Option.isNone(baseVerifierOption)) {
					return HttpServerResponse.text(
						"State and verifier could not be found in the verifier store!",
						{ status: 500 },
					);
				}

				const verifier = baseVerifierOption.value;

				const authRequest = Url.setUrlParams(
					new URL(TWITTER_OAUTH_TOKEN_URL),
					UrlParams.fromInput([
						["code", code],
						["client_id", config.clientId],
						["code_verifier", verifier],
						["redirect_uri", config.redirectUrl],
						["grant_type", "authorization_code"],
					]),
				);

				// Note: important remove the unique throw away verifier immediately
				yield* Ref.update(verifierStore, (current) =>
					HashMap.remove(current, state),
				);

				const tokenResponse = yield* makeAuthRequest(authRequest);

				const random = yield* generateRandomBytes();
				const sessionId = random.toString("base64");

				// create the user in the database if the user does not exist
				const userRes = yield* makeUserDataRequest(tokenResponse.access_token);
				yield* Effect.log(JSON.stringify(userRes));
				const data = yield* Schema.decodeUnknown(ApiUserDataResponse)(userRes);
				if (data.errors) {
					return yield* HttpServerResponse.json(data.errors, { status: 500 });
				}
				if (!data.data) {
					return HttpServerResponse.text(
						"Data from user request is not there!",
						{ status: 500 },
					);
				}

				yield* makeUser(data.data!);
				yield* Ref.update(sessionStore, (state) =>
					HashMap.set(state, sessionId, {
						userId: data.data!.id,
						tokenResponse,
					}),
				);

				return yield* HttpServerResponse.redirect(config.appUrl).pipe(
					HttpServerResponse.setCookie(
						"sessionId",
						sessionId,
						sessionCookieDefaults,
					),
				);
			}),
		),
	),
	HttpRouter.get(
		"/login",
		Effect.gen(function* () {
			const config = yield* AppConfig;
			const verifierStore = yield* VerifierStore;

			const randomState = yield* generateRandomBytes();
			const state = randomState.toString("base64");

			const randomVerifier = yield* generateRandomBytes();
			const randomVerifierBase = randomVerifier.toString("base64");
			const challengeHash = yield* Effect.tryPromise({
				try: () =>
					crypto.subtle.digest("SHA-256", Buffer.from(randomVerifierBase)),
				catch: (err) =>
					new Error("Failed to create SHA-256 digest", { cause: err }),
			});
			const challenge = Buffer.from(challengeHash).toString("base64url");

			yield* Ref.update(verifierStore, (current) =>
				HashMap.set(current, state, randomVerifierBase),
			);

			const rootUrl = "https://twitter.com/i/oauth2/authorize";
			const options = {
				redirect_uri: config.redirectUrl,
				client_id: config.clientId,
				state,
				response_type: "code",
				code_challenge: challenge,
				code_challenge_method: "S256",
				scope: [
					"users.email",
					"users.read",
					"tweet.write",
					"tweet.read",
					"follows.read",
					"follows.write",
					"offline.access",
				].join(" "), // add/remove scopes as needed
			};
			const qs = new URLSearchParams(options).toString();
			const url = `${rootUrl}?${qs}`;
			return HttpServerResponse.redirect(url);
		}),
	),
);

const app = router.pipe(HttpServer.serve(HttpMiddleware.logger));

const listenEffect = listen(
	app.pipe(
		Layer.provide(AppConfig.Default),
		Layer.provide(SessionStore.Default),
		Layer.provide(VerifierStore.Default),
		Layer.provide(SQLiteService.Default),
		Layer.provide(Logger.pretty),
		Layer.provide(FetchHttpClient.layer),
	),
	3001,
);

const cronEffect = cron();

main(listenEffect, cronEffect);
