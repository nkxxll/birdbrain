# BridBrain

This is a project to send very important and life changing messages to twitter.com (formally known as
X.com).

You only have to provide you API key as env var and the messages can flow in when you have a
creative spree you can pre-write the messages and also send them on demand.

## Features/Backlog

- [ ] send messages on demand
- [ ] send the first message in the message list on a schedule
- [ ] interact with the message list in a web interface
- [ ] save the messages sent and not sent in a SQLite database for later reference with the message
      id
- [ ] read stats on an already send message
- [ ] see the progress on the next message

## Technical considerations

### Tweet Data Type

```js
{
  id: number; // for internal reference
  twitterID: string; // for later reference with the api
  text: string;
  ...
}
```

### Use Vite for the frontend

- pros
  - I can write it really fast and the backend can be proxied
  - I can write react this enables multiple routes and complex uis
  - it is very extensible
- cons
  - features do not need it right now
  - you can get away with only providing plain js from the server
  - the js is not bundled and is not minified
- result: I am using vite with react because of the familiarity and because I don't want to struggle
  later with the problems that can come with JS only frontend no types and no bundling. I want to
  focus on the effect backend which is the interesting part with optional websockets for progress on
  when to send the next tweet.

### Goal

I want to find out whether effect is something that should be used on the backend for apps like this
where performance is not important, you can profit from the familiarity with TypeScript and you can
improve availability of the app with the improved error handling of the effect library.

## Contributions

If every someone reads this and wants to contribute... You are welcome give it a shot this is a good
first contribution to an open source project :D. Please format the code with biome first, thanks!
