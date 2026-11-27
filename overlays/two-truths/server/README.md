# Hosting the answer server

The server is one JavaScript file with nothing to install beyond Node. It reads your running order from a file, answers your chatbot, and tells the overlay what has been revealed. A Raspberry Pi that stays on is plenty, and any Linux machine works the same way.

You will need:

- a machine that is on while you stream, with Node 18 or newer (`node --version`);
- a way to give it a public `https` address. These steps use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), which opens no ports on your router. A permanent address needs a domain on your Cloudflare account;
- a chatbot that can show the reply from a web address. The commands below are for the StreamElements chatbot.

The server has automated tests. The hosting steps below have not been run from start to finish on a fresh machine, so if one does not match what you see, trust the tool's own documentation and please open an issue.

## 1. Copy the files across

From the `server` folder on your computer, replacing `YOURNAME@raspberrypi.local` with your own login:

```sh
ssh YOURNAME@raspberrypi.local 'mkdir -p ~/truth-server'
scp truth-server.js running-order.example.json truth-server.service truth.env.example YOURNAME@raspberrypi.local:truth-server/
```

Everything from here happens on that machine.

## 2. Add your running order

```sh
cd ~/truth-server
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
| `lie` | The lie, in words. |

This file is the answers, so keep it out of public repositories and off your stream. The `.gitignore` here already leaves it out.

## 3. Make a secret key

The key is what stops anyone who finds your address from reading the answers early. The server will not start without one.

```sh
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
sudo cp truth.env.example /etc/truth-server.env
sudo chmod 600 /etc/truth-server.env
sudo nano /etc/truth-server.env
```

Paste the key after `TRUTH_SECRET=` and keep a copy for step 6.

## 4. Run it as a service

Open `truth-server.service` and change `YOURNAME` in all three places. Check that `which node` prints `/usr/bin/node`, and change `ExecStart` if it does not.

```sh
sudo cp truth-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now truth-server
curl http://localhost:8099/health
```

The last command should say how many people were loaded. If it says nothing, `journalctl -u truth-server -n 20` shows why. The service starts again by itself after a reboot.

## 5. Give it a public address

Install `cloudflared` by following [Cloudflare's instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for your machine.

**For a quick test**, this prints a temporary `https` address that changes every time:

```sh
cloudflared tunnel --url http://localhost:8099
```

**For streaming**, use a named tunnel, so the address in your commands and overlay stays the same.

First check whether this machine already runs a tunnel, with `systemctl status cloudflared`. **If it does, add to that tunnel and do not make a second service**, or you may take down whatever it already serves. If it is managed in the Cloudflare dashboard, add a public hostname to it there that points to `http://localhost:8099`. If it uses a `config.yml`, add the two `truths` lines below above the final catch-all rule, create the DNS record with `cloudflared tunnel route dns`, and restart the service.

On a machine with no tunnel yet, with `truths.example.com` standing in for a name on your own domain:

```sh
cloudflared tunnel login
cloudflared tunnel create truths
cloudflared tunnel route dns truths truths.example.com
```

The second command prints the tunnel's ID and where its credentials file is. Put them in `/etc/cloudflared/config.yml`:

```yaml
tunnel: THE-TUNNEL-ID
credentials-file: /etc/cloudflared/THE-TUNNEL-ID.json
ingress:
  - hostname: truths.example.com
    service: http://localhost:8099
  - service: http_status:404
```

```sh
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/THE-TUNNEL-ID.json /etc/cloudflared/
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Then check from another network, such as a phone with Wi-Fi off, that `https://truths.example.com/health` answers.

## 6. Add the chat commands

Add these in your chatbot, with your own address in place of `truths.example.com` and your key in place of `KEY`. **Set all five to moderators only.**

| Command | Response |
| --- | --- |
| `!truth` | `${customapi.https://truths.example.com/?q=step&key=KEY}` |
| `!truthprev` | `${customapi.https://truths.example.com/?q=prev&key=KEY}` |
| `!truthnext` | `${customapi.https://truths.example.com/?q=next&key=KEY}` |
| `!truthreset` | `${customapi.https://truths.example.com/?q=reset&key=KEY}` |
| `!truthrefresh` | `${customapi.https://truths.example.com/?q=refresh&key=KEY}` |

The key sits inside the command's response, so anyone who can edit your chatbot commands can read it. Keep your chatbot dashboard off stream.

- `!truth` says who #1 was, then what their lie was, then moves to #2. Each reply names its number, so a stray press is easy to notice.
- `!truthprev` undoes the last `!truth`, `!truthnext` or `!truthreset`. Use it again to go further back, up to 100 changes. The overlay takes the undone name or lie off its card. Voting does not reopen, and chat will still have seen what was posted.
- `!truthnext` skips whoever is up, or the rest of them if their name has been read. Nothing is revealed.
- `!truthreset` goes back to the top.
- `!truthrefresh` rereads `running-order.json` after you edit it. It keeps your place.

To check one answer without moving on, `?q=who+3&key=KEY` or `?q=lie+3&key=KEY` replies without changing the round or the overlay.

## 7. Connect the overlay

In the widget's settings, put `https://truths.example.com` in **Reveals, Answer server address**. Leave the key out. The overlay does not need it.

## Before you go live

1. Run `!truthreset`.
2. Type `!vote`, then `!truth` twice.
3. Check that the name and then the lie appear on the card, and in chat.
4. Run `!truthreset` again.

## Settings

These go in `/etc/truth-server.env`. Restart with `sudo systemctl restart truth-server` after a change.

| Name | What it does |
| --- | --- |
| `TRUTH_SECRET` | Required, at least 12 characters. Use letters, numbers, `-` and `_`, so that it is safe in a web address. |
| `TRUTH_PORT` | The port, 8099 unless you change it. |
| `TRUTH_HOST` | `127.0.0.1`, so only this machine, and a tunnel on it, can connect. Change it only if your tunnel or proxy runs on another machine. |
| `TRUTH_SOURCE_URL` | Optional. An address that returns the same JSON list as `running-order.json`. `!truthrefresh` then downloads it and saves it. A failed or empty reply keeps the old list. Anyone who can open that address can read your answers, so keep it private. |
| `TRUTH_DATA` | The folder for `running-order.json` and `state.json`, which is the server's own folder unless you change it. |

## If something is wrong

| What you see | What to check |
| --- | --- |
| "Sorry, that link is missing its key." | `&key=` is in the command, and matches `/etc/truth-server.env`. |
| "There is no number 1" or "That is everyone" straight away | `curl http://localhost:8099/health`. If it says 0 people, `running-order.json` is not valid JSON. |
| The chatbot says nothing | Open the public `/health` address. If it fails, check both services with `systemctl status truth-server cloudflared`. |
| Chat gets answers but the card does not change | The overlay's address starts with `https://`, and `/state` opens in a browser. Turn on the widget's `debug` setting. |
| "Something went wrong on the answer server" | `journalctl -u truth-server -n 20`. Often the folder is not writable by the service's user. |
