/* ============================================================
   Dock Magnify — macOS-style proximity scaling for .bottom-nav
   Purely visual (transform only). No app logic touched.
   ============================================================ */
(function () {
  "use strict";

  const MAX_SCALE = 1.22;
  const FALLOFF = 90; // px radius of influence

  function attach(nav) {
    if (nav.dataset.dockMagnify) return;
    nav.dataset.dockMagnify = "1";

    let raf = null;

    function apply(mouseX) {
      const items = nav.querySelectorAll(".nav-item");
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const dist = Math.abs(mouseX - center);
        const scale = dist < FALLOFF ? 1 + (MAX_SCALE - 1) * (1 - dist / FALLOFF) : 1;
        const lift = dist < FALLOFF ? -4 * (1 - dist / FALLOFF) : 0;
        item.style.transform = `translateY(${lift}px) scale(${scale.toFixed(3)})`;
      });
    }

    function reset() {
      nav.querySelectorAll(".nav-item").forEach((item) => { item.style.transform = ""; });
    }

    nav.addEventListener("mousemove", (e) => {
      if (raf) cancelAnimationFrame(raf);
      const x = e.clientX;
      raf = requestAnimationFrame(() => apply(x));
    });
    nav.addEventListener("mouseleave", reset);
  }

  function scan() {
    document.querySelectorAll(".bottom-nav").forEach(attach);
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }
})();
