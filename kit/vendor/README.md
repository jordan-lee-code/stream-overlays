# Vendored files

`streamerbot-client.js` is `@streamerbot/client` 2.0.2, the browser build from its `dist` folder, unchanged, under the MIT licence in `streamerbot-client.LICENSE`. It is the script that talks to Streamer.bot's WebSocket server. It is copied here so that an overlay hosted by Streamer.bot itself needs no internet, and the site and the Streamer.bot download both carry it.

To update it, download the same file for the new version from `https://cdn.jsdelivr.net/npm/@streamerbot/client@<version>/dist/streamerbot-client.js`, replace this one, and change the version in `kit/shared/streamerbot.js`.
