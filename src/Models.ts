import { Data, Schema } from "effect";

export class DatabaseError extends Data.TaggedError("SessionTokenNotFound")<{
  message?: string;
  cause?: unknown;
}> {}

export class RefreshError extends Data.TaggedError("RefreshError")<{
  message?: string;
  cause?: unknown;
}> {}

export class SessionTokenNotFound extends Data.TaggedError(
  "SessionTokenNotFound"
)<{
  message?: string;
  cause?: unknown;
}> {}

export const PostApiData = Schema.Struct({
  text: Schema.String,
  id: Schema.String,
  edit_history_tweet_ids: Schema.Array(Schema.String),
});

export const ApiError = Schema.Struct({
  detail: Schema.String,
  status: Schema.Number,
  title: Schema.String,
  type: Schema.String,
});

export const UserData = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.String,
});

export type UserData = Schema.Schema.Type<typeof UserData>;

export const ApiUserDataResponse = Schema.Struct({
  data: UserData.pipe(Schema.optional),
  errors: Schema.Array(ApiError).pipe(Schema.optional),
});

export const ApiPostResponse = Schema.Struct({
  data: PostApiData.pipe(Schema.optional),
  errors: Schema.Array(ApiError).pipe(Schema.optional),
});

export type PostApiData = Schema.Schema.Type<typeof PostApiData>;
export type ApiError = Schema.Schema.Type<typeof ApiError>;
export type ApiPostResponse = Schema.Schema.Type<typeof ApiPostResponse>;

export const TwitterTokenResponseSchema = Schema.Struct({
  token_type: Schema.Literal("bearer"),
  expires_in: Schema.Number,
  access_token: Schema.String,
  refresh_token: Schema.String,
  scope: Schema.String,
});

export type TwitterTokenResponse = Schema.Schema.Type<
  typeof TwitterTokenResponseSchema
>;

export const SessionStoreItem = Schema.Struct({
  tokenResponse: TwitterTokenResponseSchema,
  userId: Schema.String,
  progress: Schema.Number,
});

export type SessionStoreItem = Schema.Schema.Type<typeof SessionStoreItem>;

export const SavePostRequest = Schema.Struct({
  userId: Schema.String,
  text: Schema.String,
});

export type SavePostRequest = Schema.Schema.Type<typeof SavePostRequest>;

export const ApiTweetPostRequest = Schema.Struct({
  text: Schema.String,
  id: Schema.Number.pipe(Schema.optional),
});

export type ApiTweetPostRequest = Schema.Schema.Type<
  typeof ApiTweetPostRequest
>;
