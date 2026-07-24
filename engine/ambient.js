/**
 * Ambient layers: birds, clouds, bubbles, sparkles.
 */
(function (global) {
  "use strict";

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function startBirds(ctx, count) {
    const n = count || 4;
    for (let i = 0; i < n; i++) {
      spawnBird(ctx, true);
    }
  }

  function spawnBird(ctx, initial) {
    if (!ctx.live) return;
    const width = ctx.root.clientWidth;
    const height = ctx.root.clientHeight;
    const fromLeft = Math.random() < 0.5;
    const y = rand(height * 0.06, height * 0.32);
    const startX = fromLeft ? -40 : width + 40;
    const endX = fromLeft ? width + 60 : -60;
    const face = fromLeft ? 1 : -1;
    const el = document.createElement("div");
    el.className = "ambient ambient--bird";
    el.style.width = "48px";
    el.style.height = "32px";
    el.style.marginLeft = "-24px";
    el.style.marginTop = "-16px";
    el.innerHTML = MashEntities.render("bird");
    el.style.transform = `translate(${startX}px, ${y}px) scaleX(${face})`;
    ctx.stage.appendChild(el);
    if (!initial && Math.random() < (MashMotion.isCalm() ? 0.08 : 0.3)) {
      MashSounds.play("chirp");
    }

    const dur = rand(6000, 12000);
    const anim = MashMotion.animate(
      el,
      [
        { transform: `translate(${startX}px, ${y}px) scaleX(${face})` },
        { transform: `translate(${endX}px, ${y + rand(-30, 30)}px) scaleX(${face})` },
      ],
      { duration: dur, easing: "linear", fill: "forwards" }
    );
    anim.onfinish = () => {
      el.remove();
      if (ctx.live && !ctx._windingDown && ctx.ambientKinds.has("birds")) {
        window.setTimeout(() => spawnBird(ctx, false), rand(400, 2000));
      }
    };
  }

  function startClouds(ctx, count) {
    const n = count || 3;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "ambient ambient--cloud";
      const w = rand(50, 90);
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.4}px`;
      el.style.left = `${rand(5, 80)}%`;
      el.style.top = `${rand(8, 28)}%`;
      el.style.animationDuration = `${rand(16, 28)}s`;
      ctx.stage.appendChild(el);
    }
  }

  function startBubbles(ctx, count) {
    const n = count || 6;
    const tick = () => {
      if (!ctx.live || ctx._windingDown || !ctx.ambientKinds.has("bubbles")) return;
      const el = document.createElement("div");
      el.className = "ambient ambient--bubble";
      const size = rand(10, 28);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      const x = rand(ctx.root.clientWidth * 0.1, ctx.root.clientWidth * 0.9);
      const startY = ctx.root.clientHeight * 0.85;
      el.style.transform = `translate(${x}px, ${startY}px)`;
      ctx.stage.appendChild(el);
      const anim = MashMotion.animate(
        el,
        [
          { transform: `translate(${x}px, ${startY}px)`, opacity: 0.8 },
          { transform: `translate(${x + rand(-40, 40)}px, ${rand(40, 120)}px)`, opacity: 0 },
        ],
        { duration: rand(2500, 4500), easing: "ease-out", fill: "forwards" }
      );
      anim.onfinish = () => el.remove();
      const gap = MashMotion.isCalm() ? rand(900, 2200) : rand(300, 900);
      window.setTimeout(tick, gap);
    };
    const startN = MashMotion.isCalm() ? 1 : Math.min(n, 3);
    for (let i = 0; i < startN; i++) window.setTimeout(tick, i * 400);
  }

  function startSparkles(ctx, count) {
    const n = count || 8;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "ambient ambient--sparkle";
      el.style.left = `${rand(5, 95)}%`;
      el.style.top = `${rand(5, 40)}%`;
      el.style.animationDelay = `${rand(0, 2)}s`;
      ctx.stage.appendChild(el);
    }
  }

  function start(ctx) {
    ctx.ambientKinds = new Set();
    const list = ctx.spec.ambient || [];
    list.forEach((a) => {
      const kind = a.kind;
      ctx.ambientKinds.add(kind);
      if (kind === "birds") startBirds(ctx, a.count);
      else if (kind === "clouds") startClouds(ctx, a.count);
      else if (kind === "bubbles") startBubbles(ctx, a.count);
      else if (kind === "sparkles") startSparkles(ctx, a.count);
    });
  }

  global.MashAmbient = { start };
})(window);
