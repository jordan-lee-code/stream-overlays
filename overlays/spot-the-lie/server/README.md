# Hosting the answer server

The server is one JavaScript file with nothing to install beyond Node. It reads your running order from a file, answers your chatbot, and tells the overlay what has been revealed. A Raspberry Pi that stays on is plenty, and any Linux machine works the same way.

You will need:

- a machine that is on while you stream, with Node 18 or newer (`node --version`);
- a way to give it a public `https` address. These steps use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), which opens no ports on your router. A permanent address needs a domain on your Cloudflare account;
- a chatbot that can show the reply from a web address. The commands below are for the StreamElements chatbot.

The server has automated tests. The hosting steps below have not been run from start to finish on a fresh machine, so if one does not match what you see, trust the tool's own documentation.

## 1. Copy the files across

On your computer, open a terminal in the folder with these files: `lie-server` if you unzipped the download, or `server` if you have the whole repository. Then run these, replacing `YOURNAME@raspberrypi.local` with your own login:

```sh
ssh YOURNAME@raspberrypi.local 'mkdir -p ~/lie-server'
scp lie-server.js running-order.example.json lie-server.service lie.env.example YOURNAME@raspberrypi.local:lie-server/
```

Everything from here happens on that machine.

## 2. Add your running order

```sh
cd ~/lie-server
cp running-order.example.json running-order.json
nano running-order.json
chmod 600 running-order.json
```

It is a list with one entry for each person:

| Key | What goes in it |
| --- | --- |
| `number` | Their place in the round: 1, 2, 3 and so on, with no gaps. |
| `username` | Who sent the statements. |
| `letter` | Which statement is the lie: `A`, `B` or `C`. It has to match the order you read them out. |
| `a`, `b`, `c` | The three statements. With all three, the first `!lie` puts them on the overlay for chat to vote on. |
| `lie` | The lie, in words. You can leave this out when `a`, `b` and `c` are there, because `letter` says which one it is. |

An entry without all three statements still works: the first `!lie` then shows only who it was, and you open the vote with `!vote`.

This file is the answers, so keep it off your stream and out of anything public.

## 3. Make a secret key

The key is what stops anyone who finds your address from reading the answers early. The server will not start without one.

```sh
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
sudo cp lie.env.example /etc/lie-server.env
sudo chmod 600 /etc/lie-server.env
sudo nano /etc/lie-server.env
```

Paste the key after `LIE_SECRET=` and keep a copy for step 6.

## 4. Run it as a service

Open `lie-server.service` and change `YOURNAME` in all three places. Check that `which node` prints `/usr/bin/node`, and change `ExecStart` if it does not.

```sh
sudo cp lie-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lie-server
curl http://localhost:8099/health
```

The last command should say how many people were loaded. If it says nothing, `journalctl -u lie-server -n 20` shows why. The service starts again by itself after a reboot.

## 5. Give it a public address

Install `cloudflared` by following [Cloudflare's instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for your machine.

**For a quick test**, this prints a temporary `https` address that changes every time:

```sh
cloudflared tunnel --url http://localhost:8099
```

**For streaming**, use a named tunnel, so the address in your commands and overlay stays the same.

First check whether this machine already runs a tunnel, with `systemctl status cloudflared`. **If it does, add to that tunnel and do not make a second service**, or you may take down whatever it already serves. If it is managed in the Cloudflare dashboard, add a public hostname to it there that points to `http://localhost:8099`. If it uses a `config.yml`, add the two `truths` lines below above the final catch-all rule, create the DNS record with `cloudflared tunnel route dns`, and restart the service.

On a machine with no tunnel yet, with `lie.example.com` standing in for a name on your own domain:

```sh
cloudflared tunnel login
cloudflared tunnel create lie
cloudflared tunnel route dns lie lie.example.com
```

The second command prints the tunnel's ID and where its credentials file is. Put them in `/etc/cloudflared/config.yml`:

```yaml
tunnel: THE-TUNNEL-ID
credentials-file: /etc/cloudflared/THE-TUNNEL-ID.json
ingress:
  - hostname: lie.example.com
    service: http://localhost:8099
  - service: http_status:404
```

```sh
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/THE-TUNNEL-ID.json /etc/cloudflared/
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Then check from another network, such as a phone with Wi-Fi off, that `https://lie.example.com/health` answers.

## 6. Add the chat commands

There are two ways to run the five commands, `!lie`, `!lieprev`, `!lienext`, `!liereset` and `!lierefresh`. **Pick one**, because with both set up a single message can move the round on twice.

| | The overlay runs them | Your chatbot runs them |
| --- | --- | --- |
| Setting up | Put the address and the key in the widget's settings | Add five commands to the chatbot |
| What you see | The card, with a short message on it for skips, going back and problems | A reply in chat, and the card |
| The overlay must be open | Yes | No |
| Where the key is kept | The widget's settings | The chatbot's commands |

### The overlay runs them

Put your key in **Reveals, Secret key**, beside the address from step 7, and remove or switch off any of these five commands in your chatbot. You and your moderators can then type them in chat, or only you if **Who can run polls** is set to the broadcaster. Nothing is posted in chat in reply. If the editor and OBS both have the overlay open, the server still runs each message once.

The key can read every answer. It is saved with the widget's settings, so it shows in the editor, in a copy of the **Data** tab or `fields.json`, and to whatever else can load the widget with its settings. Take it out before you share any of those.

If you update from an older copy, update `lie-server.js` on your server too and restart it. An older server runs the command but the overlay cannot read its reply.

### Your chatbot runs them

Leave **Secret key** empty. Add these in your chatbot, with your own address in place of `lie.example.com` and your key in place of `KEY`. **Set all five to moderators only.**

| Command | Response |
| --- | --- |
| `!lie` | `${customapi.https://lie.example.com/?q=step&key=KEY}` |
| `!lieprev` | `${customapi.https://lie.example.com/?q=prev&key=KEY}` |
| `!lienext` | `${customapi.https://lie.example.com/?q=next&key=KEY}` |
| `!liereset` | `${customapi.https://lie.example.com/?q=reset&key=KEY}` |
| `!lierefresh` | `${customapi.https://lie.example.com/?q=refresh&key=KEY}` |

The key sits inside the command's response, so anyone who can edit your chatbot commands can read it. Keep your chatbot dashboard off stream.

### What each one does

- `!lie` shows who #1 was with their three statements on the overlay, then reveals their lie, then moves to #2. Chat replies name who it was and then the lie. Each reply names its number, so a stray press is easy to notice.
- `!lieprev` undoes the last `!lie`, `!lienext` or `!liereset`. Use it again to go further back, up to 100 changes. The overlay takes the undone name or lie off its card. Voting does not reopen, and chat will still have seen what was posted.
- `!lienext` skips whoever is up, or the rest of them if their name has been read. Nothing is revealed.
- `!liereset` goes back to the top.
- `!lierefresh` rereads `running-order.json` after you edit it. It keeps your place.

To check one answer without moving on, `?q=who+3&key=KEY` or `?q=lie+3&key=KEY` replies without changing the round or the overlay.

## 7. Connect the overlay

In the widget's settings, put `https://lie.example.com` in **Reveals, Answer server address**, without the key on the end. The key only goes in **Reveals, Secret key**, and only if the overlay runs the commands.

## Before you go live

1. Run `!liereset`.
2. Run `!lie`. The card should show whose answers they are, with all three statements. If your entries do not have all three, type `!vote` first.
3. Run `!lie` again and check that the lie lights up.
4. Run `!liereset` again.

## Settings

These go in `/etc/lie-server.env`. Restart with `sudo systemctl restart lie-server` after a change.

| Name | What it does |
| --- | --- |
| `LIE_SECRET` | Required, at least 12 characters. Use letters, numbers, `-` and `_`, so that it is safe in a web address. |
| `LIE_PORT` | The port, 8099 unless you change it. |
| `LIE_HOST` | `127.0.0.1`, so only this machine, and a tunnel on it, can connect. Change it only if your tunnel or proxy runs on another machine. |
| `LIE_SOURCE_URL` | Optional. An address that returns the same JSON list as `running-order.json`. `!lierefresh` then downloads it and saves it. A failed or empty reply keeps the old list. Anyone who can open that address can read your answers, so keep it private. |
| `LIE_DATA` | The folder for `running-order.json` and `state.json`, which is the server's own folder unless you change it. |

## If something is wrong

| What you see | What to check |
| --- | --- |
| "Sorry, that link is missing its key." | `&key=` is in the command, and matches `/etc/lie-server.env`. |
| "There is no number 1" or "That is everyone" straight away | `curl http://localhost:8099/health`. If it says 0 people, `running-order.json` is not valid JSON. |
| The chatbot says nothing | Open the public `/health` address. If it fails, check both services with `systemctl status lie-server cloudflared`. |
| Chat gets answers but the card does not change | The overlay's address starts with `https://`, and `/state` opens in a browser. Turn on the widget's `debug` setting. |
| "Something went wrong on the answer server" | `journalctl -u lie-server -n 20`. Often the folder is not writable by the service's user. |
