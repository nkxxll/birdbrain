# todo

- [ ] basic frontend
  - [ ] landing page
  - [ ] application
  - [ ] navigation bar
  - [ ] style: vercel shadcn white on black no rounded corners
- [ ] provide config as layer
- [ ] sqlite database layer
- [ ] sqlite saving of future (not sent) posts
- [ ] endpoint for looking up stats of a post and saving the stats of a post with the post in the db

## effect

I have the server as the starting point of my app as a BunRuntime.runMain. I should have no
Effect runSync inside that I guess I don't know.
My effects already have deps that I could want to mock out. I need to create a layer that takes
the app or the app has to take a deps layer I am not quite sure here. But for now if it works it
works and we will adapt while going along with it.
