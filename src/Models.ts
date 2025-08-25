import { Context, Data, Schema } from "effect";

export class SessionToken extends Context.Tag("SessionToken")<
  SessionToken,
  string
>() {}

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

export const PostApiError = Schema.Struct({
  detail: Schema.String,
  status: Schema.Number,
  title: Schema.String,
  type: Schema.String,
});

export const ApiResponse = Schema.Struct({
  data: PostApiData,
  errors: Schema.Array(PostApiError).pipe(
    Schema.optional,
    Schema.withDecodingDefault(() => [])
  ),
});

export type PostApiData = Schema.Schema.Type<typeof PostApiData>;
export type PostApiError = Schema.Schema.Type<typeof PostApiError>;
export type ApiResponse = Schema.Schema.Type<typeof ApiResponse>;

export const TwitterTokenResponseSchema = Schema.Struct({
  token_type: Schema.Literal("bearer"),
  expires_in: Schema.Number,
  access_token: Schema.String,
  scope: Schema.String,
});

export type TwitterTokenResponse = Schema.Schema.Type<
  typeof TwitterTokenResponseSchema
>;

export const ApiTweetPostRequest = Schema.Struct({
  text: Schema.String,
});

export type ApiTweetPostRequest = Schema.Schema.Type<
  typeof ApiTweetPostRequest
>;
