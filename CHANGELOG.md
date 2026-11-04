# Changelog

## Unreleased

- Stream Goals no longer grows past its box in StreamElements when a goal is reached. The widget there sits in a page only as tall as its content, so "the height of the box" meant "the height of the card", and nothing could fill the box or shrink to fit it. The card now takes its height from the frame it sits in, and each goal's label and count stay on one line, shrinking their text a little instead of wrapping, so a row never gets taller when "Goal reached!" appears. When a reached goal raises itself, its words now fade out and back in with the new goal, instead of snapping.
- The dev page's Troubleshooting snapshot panel also takes the Data tab of the StreamElements editor, which loads the overlay's settings without needing the snapshot button.
- Adding to a goal from chat, such as `!goals add bits 500`, now fills the bar, pops the number, plays the sound and celebrates a reached goal, as a real sub or cheer does, instead of jumping to the new value. It still works while paused, and taking some off stays a quiet correction.
- Stream Goals can show a snapshot of its settings and saved counts, from a button or the `!goals snapshot` chat command, and the dev page has a Troubleshooting snapshot panel that loads one, with the same settings, counts and time, so a problem seen on stream can be looked at again.
- Stream Goals now shows a level next to a goal that raises itself, such as "Sub goal, Level 2", which goes up each time the goal is reached and raised. The wording is a setting, and it can be switched off. Each goal also has a growth setting, so every raise can be a multiple of the one before, such as 1.5 times, and the goals climb faster or slower as you go.
- Card-style panels now fill the height of their box by default, with their content in the middle, so a leaderboard, a task list or a reminder stays where it was put in OBS as entries come and go. Untick Fill the height of the box for the older panel that is as tall as its content.
- A large corner radius no longer lets bars and lines run out past the curve. Every panel now keeps its content inside its rounded corners, which matters most now that a design, radius included, can be carried from one overlay to another.

## 1.0.0

The twelve overlays and the standards they share, together in one repository, each with its history. Every version number starts again at 1.0.0.
