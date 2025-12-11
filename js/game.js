// Tidal Drop - Sideways Surf Edition
// Surfer stays near center while the blue wave and obstacles move left.

(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreValueEl = document.getElementById("scoreValue");
  const bestValueEl = document.getElementById("bestValue");
  const overlayEl = document.getElementById("overlay");
  const startButton = document.getElementById("startButton");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlaySubtitle = document.getElementById("overlaySubtitle");

  const gameOverPanel = document.getElementById("gameOverPanel");
  const finalScoreEl = document.getElementById("finalScore");
  const playerNameInput = document.getElementById("playerName");
  const saveScoreButton = document.getElementById("saveScoreButton");
  const skipSaveButton = document.getElementById("skipSaveButton");

  const leaderboardList = document.getElementById("leaderboardList");

  const LS_BEST_KEY = "tidalDropBestScore";
  const LS_SCORES_KEY = "tidalDropScores";

  let width = window.innerWidth;
  let height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  // Wave parameters (side-scrolling)
  const wave = {
    amplitude: height * 0.18,
    wavelength: 220,
    baseHeight: height * 0.6,
    speed: 260,   // base horizontal speed (px/s)
    offset: 0     // phase offset to move the pattern left
  };

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    wave.amplitude = height * 0.18;
    wave.baseHeight = height * 0.6;

    if (surfer.onWave) {
      surfer.y = waveY(surfer.x) - surfer.height;
    }
  }

  window.addEventListener("resize", resizeCanvas);

  // Wave height function
  function waveY(x) {
    const angle = ((x + wave.offset) / wave.wavelength) * Math.PI * 2;
    return wave.baseHeight + Math.sin(angle) * wave.amplitude;
  }

  // Game state
  let gameState = "menu"; // "menu" | "playing" | "gameover"

  const surfer = {
    x: width * 0.3,        // fixed-ish position horizontally
    y: 0,
    width: 42,
    height: 46,
    vy: 0,
    onWave: true
  };

  const physics = {
    gravity: 900,
    jumpVelocity: -550,
    maxFallSpeed: 1200
  };

  let jumpRequested = false;

  let obstacles = [];
  let spawnTimer = 0;
  let spawnInterval = 1.2; // seconds, will scale down as we go

  let distance = 0;
  let bestScore = loadBestScore();
  let difficultyTimer = 0;

  let lastTimestamp = performance.now();

  function resetGameValues() {
    surfer.x = width * 0.3;
    surfer.y = waveY(surfer.x) - surfer.height;
    surfer.vy = 0;
    surfer.onWave = true;

    obstacles = [];
    spawnTimer = 0;
    spawnInterval = 1.2;
    difficultyTimer = 0;
    distance = 0;
    wave.offset = 0;
    jumpRequested = false;
  }

  function loadBestScore() {
    const raw = localStorage.getItem(LS_BEST_KEY);
    const val = raw ? parseInt(raw, 10) : 0;
    bestValueEl.textContent = isNaN(val) ? "0" : String(val);
    return isNaN(val) ? 0 : val;
  }

  function saveBestScore(score) {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(LS_BEST_KEY, String(score));
      bestValueEl.textContent = String(score);
    }
  }

  function loadScores() {
    try {
      const raw = localStorage.getItem(LS_SCORES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveScores(scores) {
    localStorage.setItem(LS_SCORES_KEY, JSON.stringify(scores));
  }

  function addScore(name, score) {
    const scores = loadScores();
    scores.push({
      name: name || "Surfer",
      score,
      ts: Date.now()
    });
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, 10);
    saveScores(trimmed);
    renderLeaderboard(trimmed);
  }

  function renderLeaderboard(scores = loadScores()) {
    leaderboardList.innerHTML = "";
    scores.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.name}: ${entry.score}`;
      leaderboardList.appendChild(li);
    });
  }

  renderLeaderboard();

  function startGame() {
    resetGameValues();
    gameState = "playing";
    overlayEl.classList.add("hidden");
    gameOverPanel.classList.add("hidden");
  }

  function gameOver() {
    gameState = "gameover";
    const finalScore = Math.floor(distance);
    finalScoreEl.textContent = String(finalScore);
    saveBestScore(finalScore);
    gameOverPanel.classList.remove("hidden");
    playerNameInput.value = "";
    playerNameInput.focus();
  }

  function update(dt) {
    if (gameState !== "playing") return;

    // Difficulty scaling
    difficultyTimer += dt;
    const difficultyFactor = 1 + difficultyTimer * 0.08;

    const horizSpeed = wave.speed * difficultyFactor;
    wave.offset += horizSpeed * dt; // moves waves left

    // Score = distance traveled horizontally
    distance += horizSpeed * dt * 0.1;
    scoreValueEl.textContent = String(Math.floor(distance));

    // Surfer physics
    if (surfer.onWave) {
      // Attach surfer to wave unless they're just jumping
      const targetY = waveY(surfer.x) - surfer.height;
      surfer.y = targetY;
      surfer.vy = 0;

      if (jumpRequested) {
        surfer.onWave = false;
        surfer.vy = physics.jumpVelocity;
        jumpRequested = false;
      }
    } else {
      // In the air
      surfer.vy += physics.gravity * dt;
      if (surfer.vy > physics.maxFallSpeed) surfer.vy = physics.maxFallSpeed;
      surfer.y += surfer.vy * dt;

      // Land if we hit the wave from above
      const waveSurface = waveY(surfer.x) - surfer.height;
      if (surfer.y >= waveSurface) {
        surfer.y = waveSurface;
        surfer.vy = 0;
        surfer.onWave = true;
      }
    }

    // Obstacle spawning (attached to wave)
    spawnTimer += dt;
    const minInterval = 0.5;
    const effectiveInterval = Math.max(
      minInterval,
      spawnInterval / difficultyFactor
    );
    if (spawnTimer >= effectiveInterval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    // Move obstacles and detect collisions
    const toRemove = [];
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      o.x -= horizSpeed * dt;

      // Keep obstacle riding the wave
      const surfaceY = waveY(o.x);
      o.y = surfaceY - o.radius * 0.2;

      // Collision: circle vs surfer rectangle-ish
      const nearestX = Math.max(
        surfer.x - surfer.width / 2,
        Math.min(o.x, surfer.x + surfer.width / 2)
      );
      const nearestY = Math.max(
        surfer.y - surfer.height,
        Math.min(o.y, surfer.y)
      );
      const dx = o.x - nearestX;
      const dy = o.y - nearestY;
      if (dx * dx + dy * dy < o.radius * o.radius) {
        gameOver();
        break;
      }

      if (o.x + o.radius < -50) {
        toRemove.push(i);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      obstacles.splice(toRemove[i], 1);
    }
  }

  function spawnObstacle() {
    const radiusBase = 22 + Math.random() * 10;
    const types = ["rock", "buoy", "mine"];
    const type = types[Math.floor(Math.random() * types.length)];

    obstacles.push({
      x: width + radiusBase + 40,
      y: waveY(width + radiusBase),
      radius: radiusBase,
      type
    });
  }

  // Drawing

  function drawBackground(time) {
    // Sky
    const gSky = ctx.createLinearGradient(0, 0, 0, height);
    gSky.addColorStop(0, "#031730");
    gSky.addColorStop(0.4, "#04264e");
    gSky.addColorStop(1, "#02101f");
    ctx.fillStyle = gSky;
    ctx.fillRect(0, 0, width, height);

    // Distant horizon glow
    ctx.save();
    ctx.globalAlpha = 0.25;
    const hg = ctx.createRadialGradient(
      width * 0.15,
      height * 0.2,
      10,
      width * 0.15,
      height * 0.2,
      height * 0.8
    );
    hg.addColorStop(0, "#00c8ff");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Ocean fill under wave
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, height);
    const step = 20;
    for (let x = 0; x <= width; x += step) {
      const y = waveY(x);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();

    const gWater = ctx.createLinearGradient(0, height * 0.4, 0, height);
    gWater.addColorStop(0, "#024b7a");
    gWater.addColorStop(1, "#001425");
    ctx.fillStyle = gWater;
    ctx.fill();

    // Highlight wave crest
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(200, 245, 255, 0.85)";
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const y = waveY(x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSurfer() {
    const { x, y, width: w, height: h } = surfer;

    ctx.save();
    ctx.translate(x, y);
    ctx.translate(0, -h / 2);

    // Board (slight tilt)
    ctx.save();
    ctx.rotate(-0.1);
    ctx.beginPath();
    const bl = w * 1.4;
    const bw = h * 0.4;
    ctx.moveTo(-bl / 2, 0);
    ctx.quadraticCurveTo(-bl / 3, -bw, 0, -bw * 1.1);
    ctx.quadraticCurveTo(bl / 3, -bw, bl / 2, 0);
    ctx.quadraticCurveTo(bl / 3, bw, 0, bw);
    ctx.quadraticCurveTo(-bl / 3, bw, -bl / 2, 0);
    ctx.closePath();
    const boardGrad = ctx.createLinearGradient(-bl / 2, 0, bl / 2, 0);
    boardGrad.addColorStop(0, "#ff4c6a");
    boardGrad.addColorStop(1, "#ffb347");
    ctx.fillStyle = boardGrad;
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.strokeStyle = "#ffd08a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, h * 0.2);
    ctx.lineTo(-w * 0.12, h * 0.45);
    ctx.moveTo(w * 0.12, h * 0.15);
    ctx.lineTo(w * 0.12, h * 0.43);
    ctx.stroke();

    // Torso
    ctx.fillStyle = "#ffd8a0";
    ctx.beginPath();
    ctx.roundRect(-w * 0.15, -h * 0.15, w * 0.3, h * 0.35, 8);
    ctx.fill();

    // Arms
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, -h * 0.05);
    ctx.lineTo(-w * 0.3, h * 0.1);
    ctx.moveTo(w * 0.15, -h * 0.05);
    ctx.lineTo(w * 0.32, h * 0.05);
    ctx.stroke();

    // Shorts
    ctx.fillStyle = "#12c9a0";
    ctx.beginPath();
    ctx.roundRect(-w * 0.16, h * 0.05, w * 0.32, h * 0.22, 6);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -h * 0.28, h * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd8a0";
    ctx.fill();

    // Simple hair band
    ctx.beginPath();
    ctx.arc(0, -h * 0.3, h * 0.18, Math.PI * 0.1, Math.PI * 0.9);
    ctx.strokeStyle = "#f4b24f";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // Small spray trail behind board
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    const sprayY = surfer.y + 6;
    ctx.moveTo(surfer.x - w * 0.9, sprayY);
    ctx.quadraticCurveTo(
      surfer.x - w * 1.4,
      sprayY - h * 0.2,
      surfer.x - w * 1.8,
      sprayY + h * 0.1
    );
    ctx.strokeStyle = "rgba(230, 250, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacles() {
    obstacles.forEach((o) => {
      ctx.save();
      ctx.translate(o.x, o.y);

      switch (o.type) {
        case "rock":
          drawRock(o.radius);
          break;
        case "buoy":
          drawBuoy(o.radius);
          break;
        case "mine":
          drawMine(o.radius);
          break;
        default:
          drawRock(o.radius);
      }

      ctx.restore();
    });
  }

  function drawRock(r) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.3);
    ctx.lineTo(-r * 0.6, -r * 0.4);
    ctx.lineTo(0, -r * 0.9);
    ctx.lineTo(r * 0.6, -r * 0.3);
    ctx.lineTo(r * 0.9, r * 0.2);
    ctx.quadraticCurveTo(0, r * 0.7, -r * 0.9, r * 0.3);
    ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, "#1b3344");
    g.addColorStop(1, "#0b1722");
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawBuoy(r) {
    // Base float
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 0.8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "rgba(220, 240, 255, 0.7)";
    ctx.fill();

    // Mast
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.1);
    ctx.lineTo(0, -r * 1.6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top light
    ctx.beginPath();
    ctx.arc(0, -r * 1.8, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd74d";
    ctx.fill();
  }

  function drawMine(r) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "#162034";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#5472b8";
    ctx.stroke();

    const spikes = 7;
    for (let i = 0; i < spikes; i++) {
      const angle = (i / spikes) * Math.PI * 2;
      const inner = r * 0.7;
      const outer = r * 1.0;
      const x1 = Math.cos(angle) * inner;
      const y1 = Math.sin(angle) * inner;
      const x2 = Math.cos(angle) * outer;
      const y2 = Math.sin(angle) * outer;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function draw(time) {
    drawBackground(time);
    drawObstacles();
    drawSurfer();
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.03);
    lastTimestamp = timestamp;

    update(dt);
    draw(timestamp);

    requestAnimationFrame(loop);
  }

  // Input handling: just jump (space / click / touch)

  let jumpHeld = false;

  function requestJump() {
    if (!jumpHeld) {
      jumpRequested = true;
      jumpHeld = true;
    }
  }

  function releaseJump() {
    jumpHeld = false;
  }

  function handleKeyDown(e) {
    if (e.code === "Space") {
      if (gameState !== "playing") {
        startGame();
      }
      requestJump();
      e.preventDefault();
    }
  }

  function handleKeyUp(e) {
    if (e.code === "Space") {
      releaseJump();
      e.preventDefault();
    }
  }

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  function pointerDown(ev) {
    if (gameState !== "playing") {
      startGame();
    }
    requestJump();
  }

  function pointerUp() {
    releaseJump();
  }

  canvas.addEventListener("mousedown", pointerDown);
  canvas.addEventListener("mouseup", pointerUp);
  canvas.addEventListener("mouseleave", pointerUp);

  canvas.addEventListener("touchstart", pointerDown, { passive: true });
  canvas.addEventListener("touchend", pointerUp, { passive: true });
  canvas.addEventListener("touchcancel", pointerUp, { passive: true });

  // UI buttons

  startButton.addEventListener("click", () => {
    if (gameState !== "playing") {
      startGame();
    }
  });

  saveScoreButton.addEventListener("click", () => {
    if (gameState !== "gameover") return;
    const name = playerNameInput.value.trim() || "Surfer";
    const finalScore = Math.floor(distance);
    addScore(name, finalScore);
    gameOverPanel.classList.add("hidden");
  });

  skipSaveButton.addEventListener("click", () => {
    if (gameState !== "gameover") return;
    gameOverPanel.classList.add("hidden");
  });

  // Initial menu text
  overlayTitle.textContent = "Tidal Drop";
  overlaySubtitle.innerHTML =
    "Press <strong>Space</strong> or <strong>Tap</strong> to jump off the wave.<br />" +
    "Time your jumps with the blue waves to gain speed and avoid hazards.";

  // Start the render loop
  resetGameValues();
  requestAnimationFrame(loop);
})();
