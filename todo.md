# todo

- [-] basic frontend
  - [x] landing page
  - [x] application
  - [x] navigation bar
  - [x] style: vercel shadcn white on black no rounded corners
  - [x] login button
  - [-] redirect to login when getting a 401
    - [ ] does not redirect on the mutations jet this is a todo
    - [x] does redirect on the query though
  - [x] ui show sent messages as grayed out
  - [x] be able to send posts directly with the was_sent flag set already
  - [x] delete posts
  - [x] copy posts text
  - [ ] be able to save @ users or something like this just a better editing experience when
        writing a post
  - [x] emojis?! omarchy does this
- [x] provide config as layer
- [x] sqlite database layer
- [x] delete posts that are saved and not sent
- [x] sqlite saving of future (not sent) posts
- [ ] endpoint for looking up stats of a post and saving the stats of a post with the post in the db
- [x] make real crypto for the oauth flow
- [x] full session management solution somehow
- [x] reactive refresh token usage
- [x] scheduled sending of messages from the database
- [x] set up deployment
  - [x] ssh copy id to pi
  - [x] set up nginx server fully
  - [x] set up the backend as a systemctl service
  - [x] make script that updates the directories and restarts the nginx and the backend server
- [x] the random sending is broken a little bit all available posts get sent at once
- [x] send posts by user id not by session id because we want a session id per device but a user
can log in from many different devices which all get a different session id
- [-] fix refresh 400 because of token_type bearer field
