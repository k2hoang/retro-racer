# Retro Racer

A 90s-style top-down arcade racer for 1–2 players on one keyboard, against computer cars.
Everything runs in the browser. There is nothing to install, and all graphics and music are generated in code.

## Play online

**https://k2hoang.github.io/retro-racer/** opens on any computer with a keyboard.

## Start the game on this PC (works offline)

- **Double-click `Start Game.bat`.** A small server window opens, and the game opens in your browser at
  http://localhost:8080/. Close the server window when you're done.
- Or just double-click `index.html`. It works without the server too.

Press **F11** in the browser for fullscreen.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Drive | W A S D | Arrow keys |
| Use item | Space (or Q / E) | Enter (or / or Right Ctrl) |

- In 1-player mode, either set of keys works.
- **Esc** or **P** pauses the race.
- **M** turns sound on or off.
- Menus use the arrow keys (or W/S) and Enter.

## How to play

- Race 4 cars (you plus computer cars) for 2, 3 or 5 laps.
- Drive over the **?** boxes to get an item:
  - **Lightning** (turbo): a speed burst.
  - **Oil slick**: dropped behind you. Anyone who drives into it spins out.
  - **Bubble** (shield): protects you from one oil slick.
- Orange **arrow pads** give a free boost.
- Grass slows you down. If you get stuck, your car pops back onto the road after a moment.
- If you miss a checkpoint, a yellow arrow points the way back.
- **Easy** mode: the computer cars are slower, and grass and ice are much more forgiving.

## Tracks

| Track | Difficulty | What's special |
|---|---|---|
| Sunny Meadow | * | A wide, friendly oval |
| Dusty Canyon | ** | S-bends and slow sand patches |
| Frosty Peaks | ** | Slippery ice and a hairpin |
| Neon City | *** | A figure-8 with a crossing in the middle |

Best lap records and player names/colors are saved in the browser.

## Notes for grown-ups

- Some keyboards can't register many keys at once. If two kids pressing lots of keys makes a key "stick" or not respond, that's keyboard ghosting, not a game bug. An external keyboard usually helps.
- Developer extras: **F3** shows the debug overlay (checkpoints, AI targets, surfaces).
  Opening `http://localhost:8080/?selftest` runs a quick computer-only race on every track and prints the results.
- The code is plain JavaScript in `js/`. To add a track, add an entry to `js/tracks-data.js`.
