# Sub Incentives

A little overlay for a Twitch stream that shows what chat is working towards. Five subs unlocks karaoke, ten unlocks playing a game, fifteen unlocks chat confessions, and every sub that lands nudges all of the progress bars forward together.

It sits in a rounded, softly see-through black panel with white text in BioRhyme, and it is a StreamElements custom widget written in plain JavaScript, with no dependencies and nothing to install.

## How the counting works

Every sub counts as one. That means a brand new sub, a resub, a Prime sub and a single targeted gift each add one to the total, and a gift bomb adds the number of subs that were gifted.

Bits count too, at 500 bits to one sub by default, so a 1000 bit cheer moves every bar by two. A cheer too small to make a whole sub is kept rather than thrown away, so 300 bits followed by another 300 adds up to one sub with 100 left over. You can change the rate with **Bits that count as one sub** in the Goals group, and setting it to 0 switches bits off.

When bits arrive, a small strip appears at the bottom of the panel: a `+300 bits` chip over a bar. After a moment the bar fills towards the next sub slowly and evenly, over a few seconds, while the number beside it counts up in step, so you can watch the calculation happen. When the bar fills it flashes `= +1 sub`, holds, drops back and counts up to the bits left over, and then the strip tucks itself away. **Seconds the bits bar takes to calculate** and **Seconds the bits strip stays on screen once the bar has finished** in the Bits group set how long each part takes, and **Animate bits being cheered and turning into subs** switches the strip off while bits still count.

Gift bombs deserve a careful note, because StreamElements sends them as several events. There is one announcement carrying the real number of subs, and then one follow-up per recipient whose `amount` is a streak or lifetime figure (something like 170), not a count. This widget counts the announcement and skips the follow-ups, so a bomb of 10 moves the total by 10 and not by 1,710.

If you ever see a number that surprises you on a real stream, turn on **debug** in the settings. Each subscriber event is then logged to the browser-source console exactly as it arrived, which is far kinder than guessing.

## Commands

The command word is `!incentive` by default and can be renamed in the settings. Adding, removing and adjusting are for the broadcaster and moderators (or the broadcaster alone, if you choose that).

| Command | What it does |
| --- | --- |
| `!incentive add 15 chat confessions` | Adds a goal: the first number is the subs needed, the rest is its name. |
| `!incentive remove 2` | Removes the second goal in the order shown. |
| `!incentive remove karaoke` | Removes the nearest goal whose name contains that text, in any case. |
| `!incentive clear` | Removes every goal. |
| `!incentive subs +3` | Adds three to the sub count. Also `-3`, `set 12` and `=12`. |
| `!incentive bits +500` | Adds bits from somewhere else, such as a different platform. They use your bits rate, carry over leftovers and play the bits animation, and they work even while tracking is stopped. |
| `!incentive reset` | Sets the sub count back to zero and keeps the goals, ready for a new stream. |
| `!incentive stop` | Pauses tracking: new subs and bits are ignored until you start it again. A small "(paused)" note appears beside the sub count, on the title's line. |
| `!incentive start` | Resumes tracking. Nothing that arrived while it was stopped is counted afterwards. |
| `!incentive` or `!incentive list` | Gives the panel a little pop. Anyone can use this one. |

Stopping is handy for the time before a big stream: set the goals up, leave tracking stopped, and type `!incentive start` when you go live. While stopped, adding goals and `!incentive subs ...` corrections still work. You can also have it start stopped by unticking **Start with tracking on** in the Goals group, which applies on the very first load only, and there is a **Start / stop** button in Manual controls. Whether it is running survives a browser-source refresh.

If you add a goal that has already been reached, it celebrates straight away and then clears like any other.

## What chat sees

Goals are shown nearest first, with the bar filling smoothly as subs arrive. When one is reached it glows and says Unlocked! for a few moments (eight seconds by default) before it fades out and makes room for the next goal. If a gift bomb unlocks several at once, they take turns rather than all flashing at the same moment.

When every goal has been reached and the last celebration is over, a thank-you appears at the bottom of the panel: "Thank you for your generosity! <3" under a thin divider, styled like the bits strip. It goes away again if you add a goal or reset, and it needs **Keep reached goals on screen** to be ticked, because that is what keeps the finished goals there to be counted. You can change the words, switch it off, or add a full glowing bar under it, in the **Thank you** group.

By default four goals show at once. If you have more than that, the nearest unfinished ones win the slots. The panel stays out of sight entirely while there are no goals.

## Setting it up in StreamElements

Option A, importing the overlay:

1. Run `node build/build-overlay.js`.
2. In StreamElements, import `dist/incentives.overlay.json` as a new overlay.

I have to be honest that the import format StreamElements uses is not publicly documented, so this route is a best effort and I have not been able to confirm it against a live account.

Option B, pasting it in, which is the route I would trust:

1. In StreamElements, add a **Custom widget** to your overlay and open its editor.
2. Paste `widget/widget.html` into the HTML tab, `widget/widget.css` into CSS, and `widget/widget.js` into JS.
3. Open the Fields tab and paste in the contents of `widget/fields.json`.
4. Resize the widget box on the canvas. The panel is always exactly as wide as the box you draw, so it can never outgrow the stream. A goal name too long for its row shrinks to fit rather than wrapping, and is only trimmed with an ellipsis if it would have to shrink a very long way. The text scales with the box, so the panel looks the same whether you draw it small in a corner or large: the **Text size** setting is how big the text is in a box 620 pixels wide, and everything is scaled from there. If the content is too tall for the box, the text scales down a little further so everything fits inside it. About 620 by 560 pixels suits four goals.

The **Manual controls** group in the settings has buttons to add three example goals, nudge the count up and down, reset it, and clear the goals, which is handy for checking the look before going live.

## Changing things without me

Nearly everything can be changed from the widget's settings in StreamElements, so if something needs a tweak while I am away, nobody has to touch the code. Each setting has a plain label saying what it does, and they are grouped like this:

- **Commands:** the command word, who can use it, and the word for each action (`add`, `remove`, `clear`, `subs`, `bits`, `reset`, `start`, `stop`, `list`), in case you would rather say `!goal new 15 movie night`.
- **Counting:** whether new subs and resubs count, whether gifts count, whether tracking starts on, and a starting count.
- **Bits:** how many bits make a sub (0 switches bits off), whether to animate them, how many seconds the bar takes to calculate (3 by default), how long the strip stays once it has finished, and the word used for bits.
- **Goals:** how many show at once, the order, whether reached goals stay on screen, how long the celebration lasts, whether waiting goals show their target, and the longest name allowed.
- **Heading:** the title text and whether the sub count shows beside it. The title and the sub count always share one size (larger than the goals by default, and if a long title has to shrink to fit, the count shrinks with it), and each has its own boldness (extra bold by default), colour and, if you tick the box, a font of their own.
- **Wording:** the words for one sub and several subs, the celebrating text, the text beside a reached goal, and the note shown while paused.
- **Panel:** colour, opacity, corner roundness, padding, an optional outline and shadow, and where the panel sits in its box.
- **Text:** the font (BioRhyme by default), text size, line spacing, the size of the goal being worked on (the biggest line in the list) with the waiting and reached goals smaller beside it, the colour and boldness of each of those, plus strike-through and a soft shadow.
- **Progress bars:** the bar colour, the empty bar colour and opacity, the glow, the thickness and the space between goals.
- **Thank you:** the message that appears once every goal is reached, whether to show it, an optional glowing bar under it (off by default), and its size, boldness and colour.
- **Sounds:** a sound for a sub, for bits and for a goal being reached, each uploaded straight into the settings, with its own volume and one tick box that mutes everything.
- **Animation:** one tick box that switches every animation off, and how long a bar takes to fill.
- **Manual controls:** buttons to add example goals, nudge the count, start or stop tracking, reset, or clear the goals.

Chat can do the everyday things (adding goals, fixing the count, starting and stopping), and the settings cover the rest, so between them there should be very little that needs the code.

## Sounds

There are three, and each is optional: one when a sub counts, one when bits are cheered or added, and one when a goal is reached. In StreamElements, each has an upload box in the **Sounds** group of the settings, so there is nothing to host yourself. Leave a box empty for no sound.

A gift bomb plays the sub sound once, not once per recipient, and a gift bomb that reaches several goals plays the goal sound once. When a sub or cheer is the thing that reaches a goal, only the goal sound plays so the two do not talk over each other, and you can untick **When a sub or cheer reaches a goal, play only the goal sound** if you would rather hear both.

Manual corrections with `!incentive subs` are silent, though they can still reach a goal and play its sound. `!incentive bits` plays the bits sound, since it also plays the bits animation. While tracking is stopped, real subs and cheers are ignored and so make no sound at all. The **Manual controls** group has a button for each sound, handy for checking a volume without waiting for a real sub.

One thing to know: a browser can refuse to play sound until someone has interacted with the page, which can happen in a preview window. In an OBS browser source, sounds play without that.

## Trying it locally first

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/dev/`. The harness stands in for StreamElements, so you can add goals, send new subs, resubs, single gifts and full gift bombs, type chat commands as a viewer, moderator or broadcaster, change the settings, and watch a live readout of what would be saved. The **Every setting** section at the bottom of the sidebar is generated from `fields.json`, so it offers exactly what StreamElements will, which makes it the place to try a change before relying on it. Each sound setting there has a **Use a test beep** button, so you can hear the sounds without any audio files. Reset saved state clears it all and starts fresh.

It has to be served over http rather than opened as a file, and the BioRhyme font is fetched from Google Fonts, so it needs an internet connection to look right.

## Tests

```
node test/test-widget.js
```

This runs the real `widget.js` headlessly against a small mock of the page and of StreamElements, and checks sub counting (including the gift bomb trap), adding, removing and clearing goals, permissions, unlocking and fading, the visible cap, persistence across a refresh, and the look settings. It exits non-zero if anything fails.

## Notes and limitations

A widget can read chat but cannot speak in it, so `!incentive list` only pops the panel. If you would like the goals read out in chat, a StreamElements chatbot command can do that; `dist/incentives-commands.txt` has a line to start from.

The sub counting follows the event shapes in the StreamElements reference, and I have not yet watched it run against live traffic. The debug setting is there for exactly that first stream.

Goals and the sub count are saved with the StreamElements store, so a browser-source refresh keeps them. A goal that is mid-celebration when the page refreshes is treated as earned and is not brought back.

I hope it makes the moment a goal lands feel as good for chat as it does for you.
