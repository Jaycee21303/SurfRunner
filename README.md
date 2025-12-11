# Tidal Drop 🌊🏄‍♂️

**Tidal Drop** is a tiny vertical surfer arcade game that runs entirely in the browser using plain HTML, CSS, and JavaScript.

Ride a glowing blue wave, dodge rocks / buoys / sea mines, and try to push your score as high as possible. There is a local leaderboard stored in `localStorage`.

---

## Live Game

Once GitHub Pages is enabled, the game will be live at:

👉 **https://jaycee21303.github.io/Tidal-Drop/**

(If the repo name or username changes, update this URL accordingly.)

---

## How to Play

- **Desktop**
  - `←` / `A` — move left
  - `→` / `D` — move right
  - `Space` — start / restart run

- **Mobile / Touch**
  - Tap **left** side of the screen to move left
  - Tap **right** side of the screen to move right
  - First tap starts the run

**Goal:**  
Stay on the wave as long as possible, dodge obstacles, and beat your best distance. At the end of a run, you can enter a name and save your score to the local leaderboard (stored on your device).

---

## Development

This game has no build step. Everything is static.

To run it locally:

1. Clone the repo
2. Option A: open `index.html` directly in the browser  
3. Option B (recommended): serve it from a tiny dev server, for example:

   ```bash
   # Python 3
   python -m http.server 8000
   ```

Then open: http://localhost:8000

---

## Tech Stack

- HTML5 `<canvas>`
- Vanilla JavaScript
- Plain CSS (no framework)
- Local leaderboard powered by localStorage

---

## License

MIT
