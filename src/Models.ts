import { Schema } from "effect";

const Data = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
});

const ErrorItem = Schema.Struct({
  detail: Schema.String,
  status: Schema.Number,
  title: Schema.String,
  type: Schema.String,
});

export const ApiResponse = Schema.Struct({
  data: Data,
  errors: Schema.Array(ErrorItem),
});

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

export type ApiTweetPostRequest = Schema.Schema.Type<typeof ApiTweetPostRequest>;
