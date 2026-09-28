/* ============================================================
   FEATURE HUB — Sunil Bhaiya Study Tracker Power-Ups
   Self-contained add-on. Reads window.TrackerStorage (read-only)
   for real progress data; keeps all of its own feature data under
   a separate localStorage key so the core app/state is never
   touched or put at risk.
   ============================================================ */
(function () {
  "use strict";

  const LS_KEY = "cbse_hub_v1";
  const DEFAULT_DATA = {
    theme: { preset: "default", accent: "", fontSize: "md", dyslexia: false, highContrast: false, avatar: "🦁", greeting: "" },
    pomodoro: { workMin: 25, breakMin: 5 },
    todos: [],
    notes: {},
    flashcards: {},
    mockTests: [],
    weightage: {},
    pyqSolved: {},
    formulaBank: {},
    examChecklist: {},
    notif: { enabled: false, time: "18:00", lastFired: "" },
    sound: true,
    vibration: true,
    dnd: false,
    seenBadges: [],
    hideOutOfSyllabus: false,
    prepMeter: { targetPct: 90 },
    ghost: { weekStartXP: {}, savedGhost: null }
  };

  function loadHub() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
      const parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }
  function saveHub(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { /* ignore quota errors */ }
  }

  let hub = loadHub();

  function getTrackerState() {
    try { return window.TrackerStorage ? window.TrackerStorage.loadState() : null; } catch (e) { return null; }
  }
  function getProfile(state) {
    try { return window.TrackerStorage.getActiveProfile(state); } catch (e) { return null; }
  }

  // ---------------------------------------------------------------
  // SOUND & HAPTICS
  // ---------------------------------------------------------------
  let audioCtx = null;
  function beep(freq, dur) {
    if (!hub.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) { /* audio not available */ }
  }
  function playSuccess() { beep(880, 0.18); setTimeout(() => beep(1180, 0.18), 90); }
  function playClick() { beep(520, 0.06); }
  function vibrate(pattern) { if (hub.vibration && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }

  // ---------------------------------------------------------------
  // PERSONALIZATION
  // ---------------------------------------------------------------
  const THEME_PRESETS = {
    default: { primary: "#6d28ff", secondary: "#00d4c4", yellow: "#ffd23f" },
    ocean:   { primary: "#0077b6", secondary: "#00b4d8", yellow: "#90e0ef" },
    sunset:  { primary: "#ff5e5b", secondary: "#ffb703", yellow: "#ffd166" },
    forest:  { primary: "#2d6a4f", secondary: "#95d5b2", yellow: "#d8f3dc" },
    candy:   { primary: "#ff4d8d", secondary: "#b026ff", yellow: "#ffd23f" }
  };

  function applyPersonalization() {
    const root = document.documentElement;
    const t = THEME_PRESETS[hub.theme.preset] || THEME_PRESETS.default;
    const vars = ["--accent-primary", "--accent-secondary", "--accent-yellow", "--accent-gradient", "--border-focus"];
    if (hub.theme.preset === "default" && !hub.theme.accent) {
      // Default look: don't override anything, so the stylesheet's own
      // light/dark palettes apply cleanly (an inline override would beat
      // the dark-mode colours and wreck contrast).
      vars.forEach(v => root.style.removeProperty(v));
    } else {
      const primary = hub.theme.accent || t.primary;
      root.style.setProperty("--accent-primary", primary);
      root.style.setProperty("--accent-secondary", t.secondary);
      root.style.setProperty("--accent-yellow", t.yellow);
      root.style.setProperty("--accent-gradient", `linear-gradient(135deg, ${primary} 0%, ${t.secondary} 100%)`);
      root.style.setProperty("--border-focus", primary);
    }

    const sizes = { sm: "14px", md: "16px", lg: "18px", xl: "20px" };
    root.style.fontSize = sizes[hub.theme.fontSize] || "16px";

    root.classList.toggle("dyslexia-font", !!hub.theme.dyslexia);
    root.classList.toggle("high-contrast", !!hub.theme.highContrast);
    document.body.classList.toggle("hub-dnd", !!hub.dnd);
    applySyllabusTrimmer();
  }

  // ---------------------------------------------------------------
  // GAMIFICATION — XP, Level, Badges, Quotes
  // ---------------------------------------------------------------
  const QUOTES = [
    "Chhota progress bhi progress hai — keep going! 🚀",
    "Exam ki tension chhodo, ek chapter aaj khatam karo.",
    "Consistency > Intensity. Roz thoda karo.",
    "Tumse na ho payega — galat! Ho jayega, bas start karo.",
    "Revision aaj, confidence kal.",
    "Har stage jo tum complete karte ho, exam room mein kaam aayega.",
    "Break lena zaroori hai, bas skip mat karna.",
    "Future tum hi decide kar rahe ho, abhi is second mein.",
    "Ek achha din nahi, ek achhi habit banao.",
    "Weak topic se bhaago mat, usi pe double time do."
  ];
  function todaysQuote() {
    const day = new Date().getDate() + new Date().getMonth() * 31;
    return QUOTES[day % QUOTES.length];
  }

  function computeStats() {
    const state = getTrackerState();
    const profile = state ? getProfile(state) : null;
    const stats = {
      xp: 0, level: 1, levelProgress: 0, xpIntoLevel: 0, xpForLevel: 150,
      totalChapters: 0, doneChapters: 0, inProgressChapters: 0,
      streak: 0, activityByDate: {}, weakChapters: [], subjectSummaries: {},
      profile
    };
    if (!profile || !profile.progress) return stats;

    stats.streak = profile.streak ? profile.streak.count || 0 : 0;

    const now = new Date();
    Object.keys(profile.progress).forEach((key) => {
      const entry = profile.progress[key];
      if (!entry || typeof entry !== "object") return;
      const stageVals = Object.keys(entry).filter(k => k !== "updatedAt").map(k => entry[k]);
      if (!stageVals.length) return;
      stats.totalChapters += 1;

      const doneCount = stageVals.filter(v => v === "done").length;
      const progCount = stageVals.filter(v => v === "progress").length;
      stats.xp += doneCount * 15 + progCount * 5;

      if (doneCount === stageVals.length) stats.doneChapters += 1;
      else if (doneCount > 0 || progCount > 0) stats.inProgressChapters += 1;

      if (entry.updatedAt) {
        const dISO = entry.updatedAt.split("T")[0];
        stats.activityByDate[dISO] = (stats.activityByDate[dISO] || 0) + 1;

        if (progCount > 0 && doneCount < stageVals.length) {
          const days = (now - new Date(entry.updatedAt)) / 86400000;
          if (days > 5) stats.weakChapters.push({ key, days: Math.floor(days) });
        }
      }

      const subjectId = key.split(".")[0];
      if (!stats.subjectSummaries[subjectId]) stats.subjectSummaries[subjectId] = { total: 0, done: 0 };
      stats.subjectSummaries[subjectId].total += 1;
      if (doneCount === stageVals.length) stats.subjectSummaries[subjectId].done += 1;
    });

    stats.level = Math.floor(stats.xp / 150) + 1;
    stats.xpIntoLevel = stats.xp % 150;
    stats.xpForLevel = 150;
    stats.levelProgress = Math.min(100, Math.round((stats.xpIntoLevel / 150) * 100));
    stats.weakChapters.sort((a, b) => b.days - a.days);

    return stats;
  }

  function getISOWeekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return date.getUTCFullYear() + "-W" + String(weekNo).padStart(2, "0");
  }

  function ensureWeekBaseline(stats) {
    const wk = getISOWeekKey(new Date());
    if (hub.ghost.weekStartXP[wk] === undefined) {
      hub.ghost.weekStartXP[wk] = stats.xp;
      // keep only the last 8 weeks of baselines so this never grows forever
      const keys = Object.keys(hub.ghost.weekStartXP).sort();
      while (keys.length > 8) { delete hub.ghost.weekStartXP[keys.shift()]; }
      saveHub(hub);
    }
    return wk;
  }

  function computeGhost(stats) {
    const wk = ensureWeekBaseline(stats);
    const thisWeekGain = Math.max(0, stats.xp - hub.ghost.weekStartXP[wk]);
    return { thisWeekGain, saved: hub.ghost.savedGhost, currentWeekKey: wk };
  }

  function computePrepMeter(stats) {
    const target = hub.prepMeter.targetPct;
    const rows = Object.keys(stats.subjectSummaries).map(sid => {
      const s = stats.subjectSummaries[sid];
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
      const gap = target - pct;
      return { sid, pct, gap, total: s.total, done: s.done };
    });
    const draggingDown = rows.filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap);
    return { rows, draggingDown, target };
  }

  function applySyllabusTrimmer() {
    document.body.classList.toggle("hide-oos", !!hub.hideOutOfSyllabus);
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) { alert("Is browser mein text-to-speech support nahi hai."); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }

  const BADGE_DEFS = [
    { id: "first-step", icon: "🌱", label: "First Step", desc: "Mark your first stage", test: s => s.xp > 0 },
    { id: "century", icon: "💯", label: "Century", desc: "Earn 100 XP", test: s => s.xp >= 100 },
    { id: "chapter-master", icon: "📘", label: "Chapter Master", desc: "Fully finish 1 chapter", test: s => s.doneChapters >= 1 },
    { id: "streak-3", icon: "🔥", label: "3-Day Streak", desc: "Study 3 days in a row", test: s => s.streak >= 3 },
    { id: "streak-7", icon: "🔥", label: "Week Warrior", desc: "Study 7 days in a row", test: s => s.streak >= 7 },
    { id: "streak-30", icon: "🏆", label: "Unstoppable", desc: "30-day streak", test: s => s.streak >= 30 },
    { id: "halfway", icon: "⚡", label: "Halfway Hero", desc: "Any subject 50%+", test: s => Object.values(s.subjectSummaries).some(x => x.total > 0 && x.done / x.total >= 0.5) },
    { id: "champion", icon: "🥇", label: "Subject Champion", desc: "Finish a full subject", test: s => Object.values(s.subjectSummaries).some(x => x.total > 0 && x.done === x.total) },
    { id: "level-5", icon: "🚀", label: "Level 5", desc: "Reach level 5", test: s => s.level >= 5 },
    { id: "grinder", icon: "📚", label: "500 Club", desc: "Earn 500 XP", test: s => s.xp >= 500 }
  ];

  function getUnlockedBadges(stats) {
    return BADGE_DEFS.filter(b => b.test(stats));
  }

  function checkNewBadgeCelebration(stats) {
    const unlocked = getUnlockedBadges(stats).map(b => b.id);
    const newOnes = unlocked.filter(id => hub.seenBadges.indexOf(id) === -1);
    if (newOnes.length > 0) {
      hub.seenBadges = unlocked;
      saveHub(hub);
      const badge = BADGE_DEFS.find(b => b.id === newOnes[0]);
      showCelebration(badge);
    }
  }

  function showCelebration(badge) {
    playSuccess();
    vibrate([40, 30, 60]);
    const el = document.createElement("div");
    el.className = "hub-celebration";
    el.innerHTML = `<div class="hub-celebration-card">
      <div class="hub-confetti">🎉</div>
      <div class="hub-celebration-icon">${badge.icon}</div>
      <div class="hub-celebration-title">Badge Unlocked!</div>
      <div class="hub-celebration-label">${badge.label}</div>
      <div class="hub-celebration-desc">${badge.desc}</div>
    </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 400);
    }, 2600);
  }

  // ---------------------------------------------------------------
  // NOTIFICATIONS / PWA
  // ---------------------------------------------------------------
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  function requestNotifPermission(cb) {
    if (!("Notification" in window)) { cb(false); return; }
    if (Notification.permission === "granted") { cb(true); return; }
    Notification.requestPermission().then(p => cb(p === "granted"));
  }

  function checkDailyReminder() {
    if (!hub.notif.enabled) return;
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const todayISO = now.toISOString().split("T")[0];
    if (hhmm === hub.notif.time && hub.notif.lastFired !== todayISO) {
      hub.notif.lastFired = todayISO;
      saveHub(hub);
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification("📚 Study Time!", { body: "Aaj ka target chapter complete karo — Sunil Bhaiya Tracker", icon: "assets/icons/logo.svg" }); } catch (e) {}
      }
    }
  }
  setInterval(checkDailyReminder, 30000);

  function examCountdownDays() {
    const state = getTrackerState();
    const profile = state ? getProfile(state) : null;
    if (!profile || !profile.datesheet) return null;
    const dates = Object.values(profile.datesheet).filter(Boolean).map(d => new Date(d));
    if (!dates.length) return null;
    const earliest = new Date(Math.min.apply(null, dates));
    const days = Math.ceil((earliest - new Date()) / 86400000);
    return { days, date: earliest };
  }

  // ---------------------------------------------------------------
  // SHARE — canvas progress card export
  // ---------------------------------------------------------------
  function shareProgressImage() {
    const stats = computeStats();
    const name = stats.profile ? stats.profile.name : "Student";
    const canvas = document.createElement("canvas");
    canvas.width = 720; canvas.height = 900;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fef6e4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#14152b";
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = "#14152b";
    ctx.font = "800 40px sans-serif";
    ctx.fillText("🎓 " + name, 60, 110);

    ctx.font = "700 22px sans-serif";
    ctx.fillStyle = "#4a4a63";
    ctx.fillText("Sunil Bhaiya Study Tracker", 60, 145);

    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(60, 190, 600, 130);
    ctx.strokeStyle = "#14152b"; ctx.lineWidth = 4;
    ctx.strokeRect(60, 190, 600, 130);
    ctx.fillStyle = "#14152b";
    ctx.font = "800 54px sans-serif";
    ctx.fillText("Level " + stats.level, 90, 245);
    ctx.font = "700 26px sans-serif";
    ctx.fillText(stats.xp + " XP  •  🔥 " + stats.streak + " day streak", 90, 290);

    let y = 380;
    Object.keys(stats.subjectSummaries).forEach((sid) => {
      const s = stats.subjectSummaries[sid];
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
      ctx.fillStyle = "#14152b";
      ctx.font = "700 24px sans-serif";
      ctx.fillText(sid.toUpperCase() + " — " + pct + "%", 60, y);
      ctx.strokeStyle = "#14152b"; ctx.lineWidth = 3;
      ctx.strokeRect(60, y + 15, 600, 26);
      ctx.fillStyle = "#00d4c4";
      ctx.fillRect(63, y + 18, 594 * (pct / 100), 20);
      y += 75;
    });

    ctx.font = "600 18px sans-serif";
    ctx.fillStyle = "#83839c";
    ctx.fillText("Generated on " + new Date().toLocaleDateString(), 60, canvas.height - 50);

    const link = document.createElement("a");
    link.download = "my-study-progress.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ---------------------------------------------------------------
  // HEATMAP (GitHub-style activity grid)
  // ---------------------------------------------------------------
  function renderHeatmap(activityByDate) {
    const days = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({ iso, count: activityByDate[iso] || 0 });
    }
    const cells = days.map(d => {
      let level = 0;
      if (d.count >= 6) level = 4;
      else if (d.count >= 4) level = 3;
      else if (d.count >= 2) level = 2;
      else if (d.count >= 1) level = 1;
      return `<div class="heatmap-cell" data-level="${level}" title="${d.iso}: ${d.count} updates"></div>`;
    }).join("");
    return `<div class="heatmap-grid">${cells}</div>`;
  }

  // ---------------------------------------------------------------
  // MODAL / HUB UI
  // ---------------------------------------------------------------
  let currentTab = "boost";
  const TABS = [
    { id: "boost", icon: "🎮", label: "Boost" },
    { id: "map", icon: "🗺️", label: "Map" },
    { id: "tools", icon: "🛠️", label: "Tools" },
    { id: "alerts", icon: "🔔", label: "Alerts" },
    { id: "style", icon: "🎨", label: "Style" },
    { id: "smart", icon: "🧠", label: "Smart" }
  ];

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderGhostMode(stats) {
    const g = computeGhost(stats);
    const savedGain = g.saved ? g.saved.gain : 0;
    const maxScale = Math.max(g.thisWeekGain, savedGain, 50);
    const curPct = Math.min(100, Math.round((g.thisWeekGain / maxScale) * 100));
    const ghostPct = Math.min(100, Math.round((savedGain / maxScale) * 100));
    return `
      <div class="hub-section-title">👻 Ghost Mode</div>
      <div class="hub-group" style="padding:0.9rem;">
        <div class="ghost-row"><span>🏃 This week</span><span>${g.thisWeekGain} XP</span></div>
        <div class="pace-bar-track"><div class="pace-bar-fill green" style="width:${curPct}%"></div></div>
        ${g.saved ? `
        <div class="ghost-row mt-2"><span>👻 Your best week (ghost)</span><span>${savedGain} XP</span></div>
        <div class="pace-bar-track"><div class="pace-bar-fill target" style="width:${ghostPct}%"></div></div>
        <div class="hub-hint">${g.thisWeekGain >= savedGain ? "🔥 Tum apne ghost se aage nikal gaye!" : "Thoda aur push karo apne best week ko beat karne ke liye."}</div>
        ` : `<div class="hub-empty">Abhi koi ghost saved nahi — ek achha week khatam hone par save karo.</div>`}
        <button type="button" class="btn btn-sm btn-secondary btn-block mt-2" data-hub-action="save-ghost">💾 Save This Week as Ghost</button>
      </div>
    `;
  }

  let mapActiveSubject = null;

  function buildSkillTree(profile) {
    if (!profile) return [];
    const dataset = profile.grade === 9 ? (window.CLASS_9 || []) : (window.CLASS_10 || []);
    return dataset.map(subj => {
      const chapters = [];
      (subj.groups || []).forEach(g => {
        (g.chapters || []).forEach(ch => {
          const scopedId = (profile.grade === 10 && subj.id === "sst" && g.id) ? (g.id + "." + ch.id) : ch.id;
          const progKey = subj.id + "." + scopedId;
          const entry = profile.progress ? profile.progress[progKey] : null;
          let state = "none";
          if (entry) {
            const vals = Object.keys(entry).filter(k => k !== "updatedAt").map(k => entry[k]);
            if (vals.length && vals.every(v => v === "done")) state = "done";
            else if (vals.some(v => v === "done" || v === "progress")) state = "progress";
          }
          chapters.push({ no: ch.no, name: ch.name, state });
        });
      });
      return { id: subj.id, name: subj.name, chapters };
    });
  }

  function renderMapTab(stats) {
    const tree = buildSkillTree(stats.profile);
    if (!tree.length) return `<div class="hub-empty">Pehle profile setup complete karo.</div>`;
    if (!mapActiveSubject || !tree.find(s => s.id === mapActiveSubject)) mapActiveSubject = tree[0].id;

    const subjectTabs = tree.map(s => `<button type="button" class="filter-btn ${s.id === mapActiveSubject ? "active" : ""}" data-hub-action="map-subject" data-sid="${s.id}">${escapeHtml(s.name)}</button>`).join("");
    const activeSubj = tree.find(s => s.id === mapActiveSubject);
    const doneCount = activeSubj.chapters.filter(c => c.state === "done").length;

    const nodes = activeSubj.chapters.map((ch, i) => {
      const side = i % 2 === 0 ? "left" : "right";
      const icon = ch.state === "done" ? "✅" : ch.state === "progress" ? "🟡" : "⚪";
      return `<div class="skilltree-node ${side}" data-state="${ch.state}">
        <div class="skilltree-line-dot"></div>
        <div class="skilltree-card">
          <div class="skilltree-num">${icon} Ch ${ch.no}</div>
          <div class="skilltree-name">${escapeHtml(ch.name)}</div>
        </div>
      </div>`;
    }).join("");

    return `
      <div class="filter-bar">${subjectTabs}</div>
      <div class="skilltree-progress">🏁 ${doneCount}/${activeSubj.chapters.length} chapters conquered</div>
      <div class="skilltree-path">${nodes}</div>
    `;
  }

  function renderBoostTab(stats) {
    const badges = BADGE_DEFS.map(b => {
      const unlocked = b.test(stats);
      return `<div class="hub-badge ${unlocked ? "unlocked" : "locked"}" title="${escapeHtml(b.desc)}">
        <div class="hub-badge-icon">${unlocked ? b.icon : "🔒"}</div>
        <div class="hub-badge-label">${escapeHtml(b.label)}</div>
      </div>`;
    }).join("");

    return `
      <div class="hub-xp-card">
        <div class="hub-avatar">${escapeHtml(hub.theme.avatar || "🦁")}</div>
        <div class="hub-xp-info">
          <div class="hub-level-label">Level ${stats.level}</div>
          <div class="hub-xp-track"><div class="hub-xp-fill" style="width:${stats.levelProgress}%"></div></div>
          <div class="hub-xp-sub">${stats.xpIntoLevel} / ${stats.xpForLevel} XP</div>
        </div>
      </div>
      <div class="hub-quote-card">💬 ${escapeHtml(todaysQuote())}</div>
      <div class="hub-section-title">Badges</div>
      <div class="hub-badges-grid">${badges}</div>
      <div class="hub-section-title">Activity (last 12 weeks)</div>
      ${renderHeatmap(stats.activityByDate)}
      ${renderGhostMode(stats)}
      <button type="button" class="btn btn-secondary btn-block mt-4" data-hub-action="share-image">📤 Share Progress Card</button>
    `;
  }

  let formulaStudyMode = {};

  function renderFormulaSection(stats) {
    const profile = stats.profile;
    if (!profile) return "";
    const subjects = profile.grade === 9 ? (window.CLASS_9 || []) : (window.CLASS_10 || []);
    return subjects.map(subj => {
      const text = hub.formulaBank[subj.id] || "";
      const studying = !!formulaStudyMode[subj.id];
      if (studying) {
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const linesHtml = lines.length
          ? lines.map((l, i) => `<div class="formula-blur-line" data-hub-action="reveal-formula-line" data-sid="${subj.id}" data-idx="${i}">${escapeHtml(l)}</div>`).join("")
          : `<div class="hub-empty">Koi formula add nahi kiya abhi.</div>`;
        return `<div class="hub-group formula-card">
          <div class="hub-resource-subject">${escapeHtml(subj.name)} <button type="button" class="hub-mini-btn" data-hub-action="formula-edit-mode" data-sid="${subj.id}" title="Edit">✏️</button></div>
          ${linesHtml}
          <div class="hub-hint">Tap a line to reveal it — active recall practice.</div>
        </div>`;
      }
      return `<div class="hub-group formula-card">
        <div class="hub-resource-subject">${escapeHtml(subj.name)}</div>
        <textarea class="form-input" rows="3" placeholder="Har line mein ek formula ya fact likho..." data-formula-subject="${subj.id}">${escapeHtml(text)}</textarea>
        <div class="hub-formula-actions">
          <button type="button" class="btn btn-sm btn-secondary" data-hub-action="save-formula" data-sid="${subj.id}">💾 Save</button>
          <button type="button" class="btn btn-sm btn-primary" data-hub-action="formula-study-mode" data-sid="${subj.id}">🙈 Study Mode</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderToolsTab(stats) {
    const pom = hub.pomodoro;
    const todosHtml = hub.todos.map(t => `
      <div class="hub-todo-item ${t.done ? "done" : ""}" data-todo-id="${t.id}">
        <span class="hub-todo-check" data-hub-action="toggle-todo" data-id="${t.id}">${t.done ? "✅" : "⬜"}</span>
        <span class="hub-todo-text">${escapeHtml(t.text)}</span>
        <span class="hub-todo-del" data-hub-action="del-todo" data-id="${t.id}">🗑️</span>
      </div>`).join("") || `<div class="hub-empty">Koi task nahi — neeche add karo.</div>`;

    const mockRows = hub.mockTests.slice().reverse().map(m => `
      <div class="hub-mock-row">
        <span>${escapeHtml(m.name)}</span>
        <span class="hub-mock-score">${m.score}/${m.max}</span>
      </div>`).join("") || `<div class="hub-empty">Abhi koi test log nahi.</div>`;

    return `
      <div class="hub-section-title">⏱️ Pomodoro Timer</div>
      <div class="hub-pomodoro-card">
        <div class="hub-pomodoro-display" id="hubPomodoroDisplay">${pom.workMin}:00</div>
        <div class="hub-pomodoro-controls">
          <button type="button" class="btn btn-sm btn-secondary" data-hub-action="pomo-start">▶ Start</button>
          <button type="button" class="btn btn-sm btn-secondary" data-hub-action="pomo-pause">⏸ Pause</button>
          <button type="button" class="btn btn-sm btn-secondary" data-hub-action="pomo-reset">↺ Reset</button>
        </div>
      </div>

      <div class="hub-section-title">✅ Today's To-Do</div>
      <div class="hub-todo-list">${todosHtml}</div>
      <div class="hub-add-row">
        <input type="text" id="hubTodoInput" class="form-input" placeholder="Naya task likho..." />
        <button type="button" class="btn btn-sm btn-primary" data-hub-action="add-todo">Add</button>
      </div>

      <div class="hub-section-title">📝 Quick Notes</div>
      <textarea id="hubQuickNotes" class="form-input" rows="3" placeholder="Formula, doubt, ya reminder likho...">${escapeHtml(hub.notes["_quick"] || "")}</textarea>
      <button type="button" class="btn btn-sm btn-secondary mt-2" data-hub-action="save-note">💾 Save Note</button>

      <div class="hub-section-title">🧮 Formula Sheet (blur-to-reveal)</div>
      ${renderFormulaSection(stats)}

      <div class="hub-section-title">🔊 Audio Reader</div>
      <div class="hub-hint" style="margin-top:0;">Full NCERT textbook reading nahi kar sakta (book ka text hamare paas nahi hai) — lekin ye aaj ke pending chapters padh ke suna dega, taiyari revise karne ke liye.</div>
      <button type="button" class="btn btn-secondary btn-block mt-2" data-hub-action="read-focus-aloud">🔊 Read Today's Focus Aloud</button>

      <div class="hub-section-title">📊 Mock Test Scores</div>
      <div class="hub-mock-list">${mockRows}</div>
      <div class="hub-add-row">
        <input type="text" id="hubMockName" class="form-input" placeholder="Test name" style="flex:2" />
        <input type="number" id="hubMockScore" class="form-input" placeholder="Score" style="flex:1" />
        <input type="number" id="hubMockMax" class="form-input" placeholder="Out of" style="flex:1" />
        <button type="button" class="btn btn-sm btn-primary" data-hub-action="add-mock">Add</button>
      </div>
    `;
  }

  function renderAlertsTab() {
    const countdown = examCountdownDays();
    return `
      ${countdown ? `<div class="hub-countdown-card">⏳ <b>${countdown.days}</b> din baaki pehle exam tak (${countdown.date.toLocaleDateString()})</div>` : `<div class="hub-empty">Datesheet set nahi hai abhi.</div>`}

      <div class="hub-section-title">🔔 Daily Reminder</div>
      <div class="hub-toggle-row">
        <span>Reminder on</span>
        <label class="hub-switch"><input type="checkbox" id="hubNotifEnabled" ${hub.notif.enabled ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>
      <div class="hub-add-row">
        <input type="time" id="hubNotifTime" class="form-input" value="${hub.notif.time}" />
        <button type="button" class="btn btn-sm btn-primary" data-hub-action="save-notif">Save</button>
      </div>
      <div class="hub-hint">Note: browser tab/app khula hona chahiye reminder fire hone ke liye (koi background server push nahi hai).</div>

      <div class="hub-section-title">📲 Install App</div>
      <button type="button" class="btn btn-secondary btn-block" data-hub-action="install-app">⬇️ Add to Home Screen</button>

      <div class="hub-section-title">🔊 Feedback</div>
      <div class="hub-toggle-row">
        <span>Sound effects</span>
        <label class="hub-switch"><input type="checkbox" id="hubSoundToggle" ${hub.sound ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>
      <div class="hub-toggle-row">
        <span>Vibration</span>
        <label class="hub-switch"><input type="checkbox" id="hubVibrationToggle" ${hub.vibration ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>

      <div class="hub-section-title">🧘 Focus Mode</div>
      <div class="hub-toggle-row">
        <span>Do Not Disturb (dims extra cards)</span>
        <label class="hub-switch"><input type="checkbox" id="hubDndToggle" ${hub.dnd ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>
    `;
  }

  function renderStyleTab() {
    const presetOptions = Object.keys(THEME_PRESETS).map(k =>
      `<button type="button" class="hub-preset-swatch ${hub.theme.preset === k ? "active" : ""}" data-hub-action="set-preset" data-preset="${k}" style="background:${THEME_PRESETS[k].primary}"></button>`
    ).join("");
    const avatars = ["🦁", "🐯", "🦊", "🐼", "🦉", "🐸", "🐵", "🦄", "🐨", "🦅"];
    const avatarOptions = avatars.map(a => `<button type="button" class="hub-avatar-opt ${hub.theme.avatar === a ? "active" : ""}" data-hub-action="set-avatar" data-avatar="${a}">${a}</button>`).join("");

    return `
      <div class="hub-section-title">🎨 Theme Preset</div>
      <div class="hub-preset-row">${presetOptions}</div>

      <div class="hub-section-title">🖌️ Custom Accent Color</div>
      <input type="color" id="hubAccentPicker" value="${hub.theme.accent || THEME_PRESETS[hub.theme.preset].primary}" class="hub-color-input" />

      <div class="hub-section-title">🔤 Font Size</div>
      <div class="hub-preset-row">
        ${["sm", "md", "lg", "xl"].map(s => `<button type="button" class="filter-btn ${hub.theme.fontSize === s ? "active" : ""}" data-hub-action="set-fontsize" data-size="${s}">${s.toUpperCase()}</button>`).join("")}
      </div>

      <div class="hub-toggle-row">
        <span>Dyslexia-friendly font</span>
        <label class="hub-switch"><input type="checkbox" id="hubDyslexiaToggle" ${hub.theme.dyslexia ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>
      <div class="hub-toggle-row">
        <span>High contrast mode</span>
        <label class="hub-switch"><input type="checkbox" id="hubContrastToggle" ${hub.theme.highContrast ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>

      <div class="hub-section-title">🙂 Avatar</div>
      <div class="hub-preset-row">${avatarOptions}</div>

      <div class="hub-section-title">👋 Custom Greeting Name</div>
      <input type="text" id="hubGreetingInput" class="form-input" placeholder="e.g. Champ, Boss, Superstar" value="${escapeHtml(hub.theme.greeting)}" />
      <button type="button" class="btn btn-sm btn-secondary mt-2" data-hub-action="save-greeting">Save</button>
    `;
  }

  function renderPrepMeter(stats) {
    const pm = computePrepMeter(stats);
    const rows = pm.rows.map(r => `<div class="hub-subject-summary-row">
        <span class="hub-subj-name">${escapeHtml(r.sid)}</span>
        <span class="hub-subj-track"><span class="hub-subj-fill" style="width:${r.pct}%; background:${r.gap > 0 ? "var(--status-amber)" : "var(--status-green)"}"></span></span>
        <span class="hub-subj-pct">${r.pct}%${r.gap > 0 ? " (−" + r.gap + "%)" : " ✅"}</span>
      </div>`).join("");
    const flagged = pm.draggingDown.slice(0, 3).map(r => `<div class="hub-weak-row">📉 ${escapeHtml(r.sid)} is ${r.gap}% behind your ${pm.target}% target</div>`).join("")
      || `<div class="hub-empty">Sab subjects target ke barabar ya aage hai! 🎉</div>`;
    return `
      <div class="hub-section-title">🎯 Prep Meter Simulator</div>
      <div class="hub-add-row">
        <input type="number" id="hubTargetInput" class="form-input" min="1" max="100" value="${pm.target}" placeholder="Target %" />
        <button type="button" class="btn btn-sm btn-primary" data-hub-action="save-target">Set Target</button>
      </div>
      <div class="hub-group mt-2">${rows}</div>
      <div class="mt-2">${flagged}</div>
    `;
  }

  function renderSmartTab(stats) {
    const weakHtml = stats.weakChapters.length
      ? `<div class="hub-group">${stats.weakChapters.slice(0, 6).map(w => `<div class="hub-weak-row">⚠️ ${escapeHtml(w.key.replace(".", " → "))} — stuck ${w.days} din se</div>`).join("")}</div>`
      : `<div class="hub-empty">Koi stuck chapter nahi — great!</div>`;

    const subjectRows = `<div class="hub-group">${Object.keys(stats.subjectSummaries).map(sid => {
      const s = stats.subjectSummaries[sid];
      const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
      return `<div class="hub-subject-summary-row">
        <span class="hub-subj-name">${escapeHtml(sid)}</span>
        <span class="hub-subj-track"><span class="hub-subj-fill" style="width:${pct}%"></span></span>
        <span class="hub-subj-pct">${s.done}/${s.total} · ${pct}%</span>
      </div>`;
    }).join("")}</div>`;

    const profile = stats.profile;
    const subjectNames = { science: "Science", maths: "Mathematics", sst: "Social Science" };
    let resourcesHtml;
    if (!profile || profile.grade === 9) {
      resourcesHtml = `<div class="hub-empty">Class 9 ke liye abhi CFPQ PDFs available nahi hai (naye NCERT edition ka official material aana baaki hai).</div>
        <a href="${window.CBSE_PYQ_PORTAL_URL || 'https://www.cbse.gov.in/cbsenew/question-paper.html'}" target="_blank" rel="noopener" class="hub-link-row">🔗 Open Official CBSE PYQ Portal ↗</a>`;
    } else {
      const resources = window.CLASS_10_RESOURCES || {};
      const rows = Object.keys(subjectNames).map(sid => {
        const items = resources[sid] || [];
        if (!items.length) return "";
        const itemBtns = items.map(item =>
          `<button type="button" class="hub-mini-pdf-btn" data-hub-action="open-real-pdf" data-title="${escapeHtml(item.title)}" data-path="${item.path}">📄 ${escapeHtml(item.title.replace("Competency Focused Practice Questions — ", ""))}</button>`
        ).join("");
        return `<div class="hub-resource-row"><div class="hub-resource-subject">${subjectNames[sid]}</div><div class="hub-resource-pdfs">${itemBtns}</div></div>`;
      }).join("");
      resourcesHtml = `<div class="hub-group">${rows}</div>
        <a href="${window.CBSE_PYQ_PORTAL_URL}" target="_blank" rel="noopener" class="hub-link-row mt-2">🔗 Open Official CBSE PYQ Portal ↗</a>
        <button type="button" class="btn btn-sm btn-secondary btn-block mt-2" data-hub-action="go-resources">📚 Open Full Resources Screen</button>`;
    }

    const pyqRows = `<div class="hub-group">${Object.keys(stats.subjectSummaries).map(sid => `
        <div class="hub-pyq-row">
          <span>${escapeHtml(sid)}</span>
          <span class="hub-pyq-stepper">
            <button type="button" class="hub-mini-btn" data-hub-action="pyq-dec" data-sid="${sid}">−</button>
            <span class="hub-pyq-count">${hub.pyqSolved[sid] || 0}</span>
            <button type="button" class="hub-mini-btn" data-hub-action="pyq-inc" data-sid="${sid}">+</button>
          </span>
        </div>
      `).join("")}</div>`;

    const checklistItems = ["Admit Card", "Stationery (pens, geometry box)", "Water bottle", "Watch (analog)", "School ID card", "Good sleep the night before"];
    const checklistHtml = `<div class="hub-group">${checklistItems.map((item, i) => `
        <label class="hub-check-row">
          <input type="checkbox" data-hub-action="toggle-checklist" data-item="chk${i}" ${hub.examChecklist["chk" + i] ? "checked" : ""} />
          ${escapeHtml(item)}
        </label>
      `).join("")}</div>`;

    return `
      ${renderPrepMeter(stats)}

      <div class="hub-section-title">⚠️ Pace Alert</div>
      ${weakHtml}

      <div class="hub-section-title">📈 Subject Summary</div>
      ${subjectRows}

      <div class="hub-section-title">✂️ Syllabus Trimmer</div>
      <div class="hub-toggle-row">
        <span>Hide "not in this exam" chapters everywhere</span>
        <label class="hub-switch"><input type="checkbox" id="hubTrimToggle" ${hub.hideOutOfSyllabus ? "checked" : ""} /><span class="hub-switch-slider"></span></label>
      </div>

      <div class="hub-section-title">📄 Sample Papers / CFPQs / PYQs</div>
      ${resourcesHtml}

      <div class="hub-section-title">✍️ PYQs Solved (self-tracker)</div>
      ${pyqRows}

      <div class="hub-section-title">📋 Exam Day Checklist</div>
      ${checklistHtml}
    `;
  }

  function renderTabContent() {
    const stats = computeStats();
    checkNewBadgeCelebration(stats);
    switch (currentTab) {
      case "boost": return renderBoostTab(stats);
      case "map": return renderMapTab(stats);
      case "tools": return renderToolsTab(stats);
      case "alerts": return renderAlertsTab();
      case "style": return renderStyleTab();
      case "smart": return renderSmartTab(stats);
      default: return "";
    }
  }

  function renderHubModal() {
    const tabsHtml = TABS.map(t => `<button type="button" class="hub-tab ${currentTab === t.id ? "active" : ""}" data-hub-tab="${t.id}"><span class="hub-tab-icon">${t.icon}</span><span>${t.label}</span></button>`).join("");
    return `
      <div class="hub-overlay" id="hubOverlay">
        <div class="hub-panel">
          <div class="hub-panel-header">
            <span class="hub-panel-title">⚡ Feature Hub</span>
            <button type="button" class="hub-close-btn" id="hubCloseBtn">✕</button>
          </div>
          <div class="hub-tabs">${tabsHtml}</div>
          <div class="hub-panel-body" id="hubPanelBody">${renderTabContent()}</div>
        </div>
      </div>
    `;
  }

  let pomoInterval = null;
  let pomoRemaining = hub.pomodoro.workMin * 60;
  let pomoRunning = false;

  function formatTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function bindHubEvents() {
    const overlay = document.getElementById("hubOverlay");
    if (!overlay) return;

    document.getElementById("hubCloseBtn").addEventListener("click", closeHub);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeHub(); });

    overlay.querySelectorAll("[data-hub-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        playClick();
        currentTab = btn.getAttribute("data-hub-tab");
        refreshBody();
      });
    });

    const body = document.getElementById("hubPanelBody");
    body.addEventListener("click", handleHubAction);
    body.addEventListener("change", handleHubChange);
  }

  function refreshBody() {
    const overlay = document.getElementById("hubOverlay");
    if (!overlay) return;
    overlay.querySelectorAll("[data-hub-tab]").forEach(b => b.classList.toggle("active", b.getAttribute("data-hub-tab") === currentTab));
    const body = document.getElementById("hubPanelBody");
    body.innerHTML = renderTabContent();
  }

  function handleHubChange(e) {
    const t = e.target;
    if (t.id === "hubNotifEnabled") { hub.notif.enabled = t.checked; saveHub(hub); }
    if (t.id === "hubSoundToggle") { hub.sound = t.checked; saveHub(hub); }
    if (t.id === "hubVibrationToggle") { hub.vibration = t.checked; saveHub(hub); }
    if (t.id === "hubDndToggle") { hub.dnd = t.checked; saveHub(hub); applyPersonalization(); }
    if (t.id === "hubDyslexiaToggle") { hub.theme.dyslexia = t.checked; saveHub(hub); applyPersonalization(); }
    if (t.id === "hubContrastToggle") { hub.theme.highContrast = t.checked; saveHub(hub); applyPersonalization(); }
    if (t.id === "hubAccentPicker") { hub.theme.accent = t.value; saveHub(hub); applyPersonalization(); }
    if (t.id === "hubTrimToggle") { hub.hideOutOfSyllabus = t.checked; saveHub(hub); applySyllabusTrimmer(); }
    if (t.hasAttribute && t.hasAttribute("data-hub-action") && t.getAttribute("data-hub-action") === "toggle-checklist") {
      hub.examChecklist[t.getAttribute("data-item")] = t.checked;
      saveHub(hub);
    }
  }

  function handleHubAction(e) {
    const el = e.target.closest("[data-hub-action]");
    if (!el) return;
    const action = el.getAttribute("data-hub-action");
    playClick();

    if (action === "share-image") { shareProgressImage(); }

    else if (action === "add-todo") {
      const input = document.getElementById("hubTodoInput");
      const text = input.value.trim();
      if (text) {
        hub.todos.push({ id: "t" + Date.now(), text, done: false });
        saveHub(hub); refreshBody();
      }
    } else if (action === "toggle-todo") {
      const id = el.getAttribute("data-id");
      const todo = hub.todos.find(t => t.id === id);
      if (todo) { todo.done = !todo.done; if (todo.done) { playSuccess(); vibrate(30); } saveHub(hub); refreshBody(); }
    } else if (action === "del-todo") {
      hub.todos = hub.todos.filter(t => t.id !== el.getAttribute("data-id"));
      saveHub(hub); refreshBody();
    } else if (action === "save-note") {
      hub.notes["_quick"] = document.getElementById("hubQuickNotes").value;
      saveHub(hub);
    } else if (action === "add-mock") {
      const name = document.getElementById("hubMockName").value.trim();
      const score = Number(document.getElementById("hubMockScore").value);
      const max = Number(document.getElementById("hubMockMax").value);
      if (name && max) {
        hub.mockTests.push({ id: "m" + Date.now(), name, score, max, date: new Date().toISOString() });
        saveHub(hub); refreshBody();
      }
    } else if (action === "pomo-start") { startPomodoro(); }
    else if (action === "pomo-pause") { pausePomodoro(); }
    else if (action === "pomo-reset") { resetPomodoro(); }
    else if (action === "save-notif") {
      hub.notif.time = document.getElementById("hubNotifTime").value;
      saveHub(hub);
      requestNotifPermission(() => {});
    } else if (action === "install-app") {
      if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); deferredInstallPrompt = null; }
      else { alert("Install option abhi available nahi hai (browser support nahi karta ya pehle se installed hai)."); }
    } else if (action === "set-preset") {
      hub.theme.preset = el.getAttribute("data-preset");
      hub.theme.accent = "";
      saveHub(hub); applyPersonalization(); refreshBody();
    } else if (action === "set-fontsize") {
      hub.theme.fontSize = el.getAttribute("data-size");
      saveHub(hub); applyPersonalization(); refreshBody();
    } else if (action === "set-avatar") {
      hub.theme.avatar = el.getAttribute("data-avatar");
      saveHub(hub); refreshBody();
    } else if (action === "save-greeting") {
      hub.theme.greeting = document.getElementById("hubGreetingInput").value.trim();
      saveHub(hub);
    } else if (action === "pyq-inc") {
      const sid = el.getAttribute("data-sid");
      hub.pyqSolved[sid] = (hub.pyqSolved[sid] || 0) + 1;
      saveHub(hub); refreshBody();
    } else if (action === "pyq-dec") {
      const sid = el.getAttribute("data-sid");
      hub.pyqSolved[sid] = Math.max(0, (hub.pyqSolved[sid] || 0) - 1);
      saveHub(hub); refreshBody();
    } else if (action === "open-real-pdf") {
      // Reuses the real app's own PDF viewer (openPdfModal) by dispatching
      // a click through the same document-level [data-action] delegation
      // app.js already listens on — so the actual PDFs from the real site
      // open, not a hub-invented substitute.
      const title = el.getAttribute("data-title");
      const path = el.getAttribute("data-path");
      closeHub();
      const tmp = document.createElement("button");
      tmp.setAttribute("data-action", "view-pdf");
      tmp.dataset.title = title;
      tmp.dataset.pdfPath = path;
      tmp.style.display = "none";
      document.body.appendChild(tmp);
      tmp.click();
      tmp.remove();
    } else if (action === "go-resources") {
      closeHub();
      const tmp = document.createElement("button");
      tmp.setAttribute("data-action", "nav-resources");
      tmp.style.display = "none";
      document.body.appendChild(tmp);
      tmp.click();
      tmp.remove();
    } else if (action === "map-subject") {
      mapActiveSubject = el.getAttribute("data-sid");
      refreshBody();
    } else if (action === "save-ghost") {
      const stats = computeStats();
      const g = computeGhost(stats);
      hub.ghost.savedGhost = { gain: g.thisWeekGain, savedAt: new Date().toISOString() };
      saveHub(hub);
      playSuccess(); vibrate([30, 20, 30]);
      refreshBody();
    } else if (action === "save-target") {
      const val = Math.max(1, Math.min(100, Number(document.getElementById("hubTargetInput").value) || 90));
      hub.prepMeter.targetPct = val;
      saveHub(hub); refreshBody();
    } else if (action === "save-formula") {
      const sid = el.getAttribute("data-sid");
      const ta = document.querySelector('[data-formula-subject="' + sid + '"]');
      if (ta) { hub.formulaBank[sid] = ta.value; saveHub(hub); playSuccess(); }
    } else if (action === "formula-study-mode") {
      formulaStudyMode[el.getAttribute("data-sid")] = true;
      refreshBody();
    } else if (action === "formula-edit-mode") {
      formulaStudyMode[el.getAttribute("data-sid")] = false;
      refreshBody();
    } else if (action === "reveal-formula-line") {
      el.classList.toggle("revealed");
    } else if (action === "read-focus-aloud") {
      const stats = computeStats();
      const tree = buildSkillTree(stats.profile);
      const pending = [];
      tree.forEach(s => s.chapters.forEach(c => { if (c.state !== "done" && pending.length < 5) pending.push(s.name + " chapter " + c.no); }));
      const text = pending.length ? "Aaj padhne ke liye: " + pending.join(", ") : "Sab kuch complete ho chuka hai, badhiya kaam!";
      speakText(text);
    }
  }

  function updatePomoDisplay() {
    const el = document.getElementById("hubPomodoroDisplay");
    if (el) el.textContent = formatTime(pomoRemaining);
  }

  function startPomodoro() {
    if (pomoRunning) return;
    pomoRunning = true;
    pomoInterval = setInterval(() => {
      pomoRemaining -= 1;
      updatePomoDisplay();
      if (pomoRemaining <= 0) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        playSuccess();
        vibrate([50, 50, 50]);
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification("⏰ Pomodoro done!", { body: "Break time — 5 min rest." }); } catch (e) {}
        }
        pomoRemaining = hub.pomodoro.workMin * 60;
        updatePomoDisplay();
      }
    }, 1000);
  }
  function pausePomodoro() { pomoRunning = false; clearInterval(pomoInterval); }
  function resetPomodoro() { pausePomodoro(); pomoRemaining = hub.pomodoro.workMin * 60; updatePomoDisplay(); }

  function openHub() {
    closeHub();
    const wrapper = document.createElement("div");
    wrapper.id = "hubRoot";
    wrapper.innerHTML = renderHubModal();
    document.body.appendChild(wrapper);
    requestAnimationFrame(() => {
      const overlay = document.getElementById("hubOverlay");
      if (overlay) overlay.classList.add("open");
    });
    bindHubEvents();
    playClick();
  }
  function closeHub() {
    const root = document.getElementById("hubRoot");
    if (root) {
      const overlay = root.querySelector(".hub-overlay");
      if (overlay) overlay.classList.remove("open");
      setTimeout(() => root.remove(), 200);
    }
  }

  function injectFAB() {
    if (document.getElementById("hubFab")) return;
    const fab = document.createElement("button");
    fab.id = "hubFab";
    fab.type = "button";
    fab.className = "hub-fab";
    fab.innerHTML = "⚡";
    fab.title = "Feature Hub";
    fab.addEventListener("click", openHub);
    document.body.appendChild(fab);
  }

  function init() {
    applyPersonalization();
    injectFAB();
    pomoRemaining = hub.pomodoro.workMin * 60;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
