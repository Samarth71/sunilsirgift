/* ============================================================
   WILD FEATURES — comic-book "juicy" done animation + doodle canvas
   Read-only against the real app state; never writes to it.
   ============================================================ */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // 1) COMIC-BOOK "JUICY" ANIMATION — fires the instant a stage is
  //    marked fully DONE. We record the state just BEFORE app.js's
  //    own click handler runs (capture phase fires first), then
  //    compare against the real, authoritative state just after —
  //    so this never guesses and never double-fires.
  // ---------------------------------------------------------------
  const COMIC_WORDS = ["BOOM!", "DONE!", "CRUSHED IT!", "NAILED IT!", "ZAP!", "YES!"];

  function getChapterProgress(subjectId, chapterId) {
    try {
      const state = window.TrackerStorage.loadState();
      const profile = window.TrackerStorage.getActiveProfile(state);
      if (!profile || !profile.progress) return null;
      return profile.progress[subjectId + "." + chapterId] || null;
    } catch (e) { return null; }
  }

  function isFullyDone(entry) {
    if (!entry) return false;
    const vals = Object.keys(entry).filter(k => k !== "updatedAt").map(k => entry[k]);
    return vals.length > 0 && vals.every(v => v === "done");
  }

  document.addEventListener("click", function (e) {
    const dot = e.target.closest('[data-action="cycle-stage-dot"]');
    if (!dot) return;
    const subjectId = dot.getAttribute("data-subject-id");
    const chapterId = dot.getAttribute("data-chapter-id");
    if (!subjectId || !chapterId) return;

    const before = getChapterProgress(subjectId, chapterId);
    const wasFullyDone = isFullyDone(before);

    // Let app.js's own bubble-phase handler run first, then check the
    // real, saved result.
    setTimeout(() => {
      const after = getChapterProgress(subjectId, chapterId);
      if (!wasFullyDone && isFullyDone(after)) {
        triggerComicBoom();
      }
    }, 30);
  }, true); // capture phase — runs before app.js's handler

  function triggerComicBoom() {
    const word = COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)];
    document.body.classList.add("comic-shake");
    setTimeout(() => document.body.classList.remove("comic-shake"), 420);

    const el = document.createElement("div");
    el.className = "comic-boom";
    el.innerHTML = `<span class="comic-boom-text">${word}</span>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 900);

    if (navigator.vibrate) { try { navigator.vibrate([25, 15, 40]); } catch (er) {} }
  }

  // ---------------------------------------------------------------
  // 2) DOODLE CANVAS — a toggleable full-screen sketch layer, like
  //    scribbling in a textbook margin. Saved as a PNG snapshot in
  //    localStorage so it survives reloads; totally separate from
  //    app state.
  // ---------------------------------------------------------------
  const DOODLE_KEY = "cbse_doodle_v1";
  let doodleActive = false;
  let canvas, ctx, drawing = false, lastX = 0, lastY = 0;
  let currentColor = "#14152b";
  const COLORS = ["#14152b", "#e0393e", "#6d28ff", "#06a271", "#ffd23f"];

  function buildDoodleUI() {
    canvas = document.createElement("canvas");
    canvas.id = "doodleCanvas";
    canvas.className = "doodle-canvas";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resizeCanvas();

    const toolbar = document.createElement("div");
    toolbar.id = "doodleToolbar";
    toolbar.className = "doodle-toolbar";
    toolbar.innerHTML = `
      ${COLORS.map(c => `<button type="button" class="doodle-color" data-color="${c}" style="background:${c}"></button>`).join("")}
      <button type="button" class="doodle-btn" id="doodleClearBtn">🗑️</button>
      <button type="button" class="doodle-btn" id="doodleCloseBtn">✕</button>
    `;
    document.body.appendChild(toolbar);

    toolbar.querySelectorAll(".doodle-color").forEach(btn => {
      btn.addEventListener("click", () => {
        currentColor = btn.getAttribute("data-color");
        toolbar.querySelectorAll(".doodle-color").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
    toolbar.querySelector("#doodleClearBtn").addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveDoodle();
    });
    toolbar.querySelector("#doodleCloseBtn").addEventListener("click", toggleDoodle);

    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.stroke();
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener("pointerup", () => { if (drawing) { drawing = false; saveDoodle(); } });
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const img = canvas.toDataURL ? canvas.toDataURL() : null;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    loadDoodle();
  }

  function saveDoodle() {
    try { localStorage.setItem(DOODLE_KEY, canvas.toDataURL()); } catch (e) {}
  }
  function loadDoodle() {
    try {
      const data = localStorage.getItem(DOODLE_KEY);
      if (data) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = data;
      }
    } catch (e) {}
  }

  function toggleDoodle() {
    doodleActive = !doodleActive;
    if (doodleActive) {
      if (!canvas) buildDoodleUI();
      canvas.classList.add("active");
      document.getElementById("doodleToolbar").classList.add("active");
    } else if (canvas) {
      canvas.classList.remove("active");
      document.getElementById("doodleToolbar").classList.remove("active");
    }
  }

  function injectDoodleFab() {
    if (document.getElementById("doodleFab")) return;
    const fab = document.createElement("button");
    fab.id = "doodleFab";
    fab.type = "button";
    fab.className = "doodle-fab";
    fab.innerHTML = "✏️";
    fab.title = "Doodle mode — margin scribbles";
    fab.addEventListener("click", toggleDoodle);
    document.body.appendChild(fab);
  }

  function init() { injectDoodleFab(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
