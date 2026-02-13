const card = document.getElementById("valentine-card");
const question = document.getElementById("question");
const actions = document.getElementById("actions");
const yesButton = document.getElementById("yes-button");
const noButton = document.getElementById("no-button");
const success = document.getElementById("success");

let originRect = null;
let currentOffset = { x: 0, y: 0 };
let lastMoveAt = 0;
const debounceMs = 320;
const hoverRadius = 100;
const touchRadius = 120;
const insetPadding = 16;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const setNoButtonTransform = (offset, rotation, scale) => {
  currentOffset = offset;
  noButton.style.transform = `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`;
};

const measureOrigin = () => {
  const rect = noButton.getBoundingClientRect();
  originRect = {
    width: rect.width,
    height: rect.height,
    left: rect.left - currentOffset.x,
    top: rect.top - currentOffset.y,
  };
};

const rectFromOffset = (offset) => {
  const left = originRect.left + offset.x;
  const top = originRect.top + offset.y;
  return {
    left,
    top,
    right: left + originRect.width,
    bottom: top + originRect.height,
    width: originRect.width,
    height: originRect.height,
  };
};

const rectsOverlap = (a, b, padding = 6) => {
  return !(
    a.right < b.left + padding ||
    a.left > b.right - padding ||
    a.bottom < b.top + padding ||
    a.top > b.bottom - padding
  );
};

// Runaway algorithm: compute safe translation bounds inside the viewport, avoid overlap with "Yes", and debounce moves.
const moveNoButton = (reason) => {
  const now = performance.now();
  if (now - lastMoveAt < debounceMs) return;
  lastMoveAt = now;

  measureOrigin();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let minX = insetPadding - originRect.left;
  let maxX = viewportWidth - insetPadding - originRect.width - originRect.left;
  let minY = insetPadding - originRect.top;
  let maxY = viewportHeight - insetPadding - originRect.height - originRect.top;

  if (maxX < minX) {
    minX = 0;
    maxX = 0;
  }
  if (maxY < minY) {
    minY = 0;
    maxY = 0;
  }

  const yesRect = yesButton.getBoundingClientRect();
  let attempt = 0;
  let finalOffset = currentOffset;

  while (attempt < 12) {
    const offset = {
      x: clamp(randomBetween(minX, maxX), minX, maxX),
      y: clamp(randomBetween(minY, maxY), minY, maxY),
    };

    const candidateRect = rectFromOffset(offset);
    if (!rectsOverlap(candidateRect, yesRect, 10)) {
      finalOffset = offset;
      break;
    }
    attempt += 1;
  }

  const rotation = randomBetween(-6, 6);
  const scale = randomBetween(0.97, 1.04);
  setNoButtonTransform(finalOffset, rotation, scale);
};

const handlePointerMove = (event) => {
  if (event.pointerType && event.pointerType !== "mouse") return;

  const rect = noButton.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
  if (distance < hoverRadius) {
    moveNoButton("pointer-proximity");
  }
};

// Mobile touch proximity handling: tap-to-evade plus proximity checks during touchmove.
const handleTouchMove = (event) => {
  const touch = event.touches[0];
  if (!touch) return;

  const rect = noButton.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const distance = Math.hypot(touch.clientX - centerX, touch.clientY - centerY);
  if (distance < touchRadius) {
    moveNoButton("touch-proximity");
  }
};

const setupRunaway = () => {
  measureOrigin();
  window.addEventListener("resize", measureOrigin);
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("touchmove", handleTouchMove, { passive: true });

  noButton.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      moveNoButton("tap-evade");
    },
    { passive: false }
  );

  // Click-to-dart behavior so the button hops to a new location on click.
  noButton.addEventListener("click", (event) => {
    event.preventDefault();
    moveNoButton("click-dart");
  });
};

// Confetti and heart effects use light DOM/canvas work with cleanup after 6-8 seconds.
const launchConfetti = (durationMs = 7200) => {
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const colors = ["#f7a8b8", "#fbd3e0", "#d6c7f7", "#c8f0df", "#ffe1c7"];
  const particleCount = 120;
  const gravity = 0.18;
  const drag = 0.98;
  const particles = [];

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const createParticle = () => ({
    x: randomBetween(0, window.innerWidth),
    y: randomBetween(-40, window.innerHeight * 0.2),
    vx: randomBetween(-2.2, 2.2),
    vy: randomBetween(-1.5, 2.8),
    size: randomBetween(6, 11),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: randomBetween(0, Math.PI),
    spin: randomBetween(-0.08, 0.08),
  });

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  for (let i = 0; i < particleCount; i += 1) {
    particles.push(createParticle());
  }

  let startTime = performance.now();
  const draw = (timestamp) => {
    const elapsed = timestamp - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle) => {
      particle.vy += gravity;
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;

      if (particle.y > window.innerHeight + 30) {
        particle.y = -20;
        particle.vy = randomBetween(-2, 2);
      }

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();
    });

    if (elapsed < durationMs) {
      requestAnimationFrame(draw);
    } else {
      window.removeEventListener("resize", resizeCanvas);
      canvas.remove();
    }
  };

  requestAnimationFrame(draw);
};

const launchFloatingHearts = (durationMs = 7200) => {
  const layer = document.createElement("div");
  layer.className = "hearts-layer";
  document.body.appendChild(layer);

  const heartCount = 18;
  for (let i = 0; i < heartCount; i += 1) {
    const heart = document.createElement("div");
    heart.className = "heart-float";
    heart.style.left = `${randomBetween(8, 92)}%`;
    heart.style.animationDelay = `${randomBetween(0, 1.6)}s`;
    heart.style.animationDuration = `${randomBetween(4.8, 6.5)}s`;
    heart.style.transform = `translateY(${randomBetween(20, 60)}px) scale(${randomBetween(0.7, 1.15)})`;
    layer.appendChild(heart);
  }

  setTimeout(() => {
    layer.remove();
  }, durationMs);
};

const playChime = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
    gain.gain.setValueAtTime(0.07, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.28);

    oscillator.onended = () => audioContext.close();
  } catch (error) {
    // Audio is optional; ignore failures without impacting the experience.
  }
};

const showSuccessState = () => {
  question.hidden = true;
  success.hidden = false;
  success.classList.add("is-visible");
  card.classList.add("is-success");
  playChime();
  launchConfetti();
  launchFloatingHearts();
  yesButton.blur();
};

yesButton.addEventListener("click", showSuccessState);

setupRunaway();
