/**
 * Spawn behaviors for catalog + custom entities.
 */
(function (global) {
  "use strict";

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function zoneRect(zoneEl, rootEl) {
    if (!zoneEl) {
      const r = rootEl.getBoundingClientRect();
      return { left: r.width * 0.15, top: r.height * 0.45, width: r.width * 0.7, height: r.height * 0.35 };
    }
    const z = zoneEl.getBoundingClientRect();
    const root = rootEl.getBoundingClientRect();
    return {
      left: z.left - root.left,
      top: z.top - root.top,
      width: z.width,
      height: z.height,
    };
  }

  function makeEl(meta, html, x, y, mode) {
    const el = document.createElement("div");
    el.className = `ent ent--${meta.kind}`;
    el.style.width = `${meta.width}px`;
    el.style.height = `${meta.height}px`;
    el.style.marginLeft = `${-meta.width / 2}px`;
    el.style.marginTop = `${-meta.height * 0.55}px`;
    if (mode === "transform") {
      el.style.left = "0";
      el.style.top = "0";
      el.style.transform = `translate(${x}px, ${y}px)`;
    } else {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    el.innerHTML = html;
    return el;
  }

  function customHtml(meta) {
    if (meta.svg) {
      if (meta.svg.includes("<svg")) return meta.svg.replace("<svg", '<svg class="ent__svg"');
      return `<svg class="ent__svg" viewBox="0 0 ${meta.width} ${meta.height}">${meta.svg}</svg>`;
    }
    return MashEntities.render(meta.kind) || `<div class="ent__fallback">${meta.kind}</div>`;
  }

  function spawnBakeReady(ctx, kind, meta) {
    const p = zoneRect(ctx.spawnZone, ctx.root);
    const x = p.left + rand(p.width * 0.12, p.width * 0.88);
    const y = p.top + rand(p.height * 0.25, p.height * 0.78);
    const el = makeEl(meta, MashEntities.render("cookie", { stage: "dough" }), x, y, "css");
    el.classList.add("is-dropping");
    ctx.stage.appendChild(el);
    if (meta.soundSpawn) MashSounds.play(meta.soundSpawn);

    const treat = { el, x, y, ready: false, claimed: false, kind, meta };
    ctx.treats.push(treat);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-baking");
      el.innerHTML = MashEntities.render("cookie", { stage: "baking" });
    }, 450);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-baking");
      el.classList.add("is-ready");
      treat.ready = true;
      el.innerHTML = MashEntities.render("cookie", { stage: "ready" });
      if (meta.soundReady) MashSounds.play(meta.soundReady);
      ctx.maybeSendActor();
    }, 450 + 3200);

    return treat;
  }

  function spawnDropReady(ctx, kind, meta) {
    const p = zoneRect(ctx.spawnZone, ctx.root);
    const x = p.left + rand(p.width * 0.12, p.width * 0.88);
    const y = p.top + rand(p.height * 0.2, p.height * 0.75);
    const html =
      kind === "icecream"
        ? MashEntities.render("icecream")
        : kind === "ball"
          ? MashEntities.render("ball")
          : kind === "star"
            ? MashEntities.render("star")
            : customHtml(meta);
    const el = makeEl(meta, html, x, y, "css");
    el.classList.add("is-dropping");
    ctx.stage.appendChild(el);
    if (meta.soundSpawn) MashSounds.play(meta.soundSpawn);

    const treat = { el, x, y, ready: false, claimed: false, kind, meta };
    ctx.treats.push(treat);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-ready");
      treat.ready = true;
      if (meta.soundReady) MashSounds.play(meta.soundReady);
      ctx.maybeSendActor();
    }, 520);

    return treat;
  }

  function spawnFloatPop(ctx, kind, meta) {
    const width = ctx.root.clientWidth;
    const height = ctx.root.clientHeight;
    const startX = rand(width * 0.12, width * 0.88);
    const startY = height * 0.78 + rand(-20, 30);
    const endX = startX + rand(-80, 80);
    const endY = rand(height * 0.08, height * 0.32);
    const html = kind === "balloon" ? MashEntities.render("balloon") : customHtml(meta);
    const el = makeEl(meta, html, startX, startY, "transform");
    el.classList.add("is-inflating");
    ctx.stage.appendChild(el);
    ctx.spawnCount += 1;
    if (meta.soundSpawn) MashSounds.play(meta.soundSpawn);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-inflating");
      el.classList.add("is-floating");
      if (meta.soundReady) MashSounds.play(meta.soundReady);
      const floatMs = rand(1800, 3200);
      const anim = MashMotion.animate(
        el,
        [
          { transform: `translate(${startX}px, ${startY}px)` },
          { transform: `translate(${endX}px, ${endY}px)` },
        ],
        { duration: floatMs, easing: "ease-out", fill: "forwards" }
      );
      anim.onfinish = () => {
        if (!el.isConnected) return;
        el.classList.remove("is-floating");
        el.classList.add("is-popping");
        if (meta.soundInteract) MashSounds.play(meta.soundInteract);
        for (let i = 0; i < 8; i++) {
          const spark = document.createElement("div");
          spark.className = "spark";
          spark.style.left = `${endX}px`;
          spark.style.top = `${endY}px`;
          spark.style.background = MashEntities.pick(["#ff6b9d", "#5ab0ff", "#ffe066", "#b8e986", "#fff"]);
          spark.style.setProperty("--dx", `${rand(-70, 70)}px`);
          spark.style.setProperty("--dy", `${rand(-70, 50)}px`);
          ctx.stage.appendChild(spark);
          window.setTimeout(() => spark.remove(), 560);
        }
        window.setTimeout(() => {
          if (el.isConnected) el.remove();
          ctx.spawnCount = Math.max(0, ctx.spawnCount - 1);
        }, 340);
      };
    }, 520);
  }

  function spawnSplashSwim(ctx, kind, meta) {
    const p = zoneRect(ctx.spawnZone, ctx.root);
    const landX = p.left + rand(p.width * 0.15, p.width * 0.85);
    const landY = p.top + rand(p.height * 0.25, p.height * 0.75);
    const fromLeft = Math.random() < 0.5;
    const face = fromLeft ? 1 : -1;
    const exitX = fromLeft ? p.left + p.width + 80 : p.left - 80;
    const exitY = landY + rand(-30, 40);
    const html = kind === "duck" ? MashEntities.render("duck") : customHtml(meta);
    const el = makeEl(meta, html, landX, landY, "transform");
    el.style.transform = `translate(${landX}px, ${landY}px) scaleX(${face})`;
    el.classList.add("is-dropping");
    ctx.stage.appendChild(el);
    ctx.spawnCount += 1;
    if (meta.soundSpawn) MashSounds.play(meta.soundSpawn);

    for (let i = 0; i < 2; i++) {
      const ripple = document.createElement("div");
      ripple.className = "ripple";
      ripple.style.left = `${landX + rand(-8, 8)}px`;
      ripple.style.top = `${landY + 10 + i * 4}px`;
      ctx.stage.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 720);
    }

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-swimming");
      if (meta.soundInteract) {
        MashSounds.play(meta.soundInteract);
        window.setTimeout(() => MashSounds.play(meta.soundInteract), 280);
      }
      MashSounds.play("swim");
      const swimMs = rand(2200, 3800);
      const anim = MashMotion.animate(
        el,
        [
          { transform: `translate(${landX}px, ${landY}px) scaleX(${face})` },
          { transform: `translate(${(landX + exitX) / 2}px, ${landY + rand(-20, 20)}px) scaleX(${face})` },
          { transform: `translate(${exitX}px, ${exitY}px) scaleX(${face})` },
        ],
        { duration: swimMs, easing: "ease-in-out", fill: "forwards" }
      );
      anim.onfinish = () => {
        if (el.isConnected) el.remove();
        ctx.spawnCount = Math.max(0, ctx.spawnCount - 1);
      };
    }, 450);
  }

  function spawnScurryNibble(ctx, kind, meta) {
    const p = zoneRect(ctx.spawnZone, ctx.root);
    const fromLeft = Math.random() < 0.5;
    const face = fromLeft ? 1 : -1;
    const holeX = fromLeft ? p.left + p.width * 0.08 : p.left + p.width * 0.92;
    const holeY = p.top + p.height * 0.55;
    const nibbleX = p.left + rand(p.width * 0.32, p.width * 0.68);
    const nibbleY = p.top + rand(p.height * 0.2, p.height * 0.55);
    const exitX = fromLeft ? p.left + p.width + 60 : p.left - 60;
    const exitY = holeY + rand(-20, 25);
    const html = kind === "mouse" ? MashEntities.render("mouse") : customHtml(meta);
    const el = makeEl(meta, html, holeX, holeY, "transform");
    el.style.transform = `translate(${holeX}px, ${holeY + 40}px) scaleX(${face})`;
    el.classList.add("is-dropping");
    ctx.stage.appendChild(el);
    ctx.spawnCount += 1;
    if (meta.soundSpawn) MashSounds.play(meta.soundSpawn);

    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.classList.remove("is-dropping");
      el.classList.add("is-scurrying");
      const scurryMs = rand(900, 1500);
      const anim = MashMotion.animate(
        el,
        [
          { transform: `translate(${holeX}px, ${holeY}px) scaleX(${face})` },
          { transform: `translate(${nibbleX}px, ${nibbleY}px) scaleX(${face})` },
        ],
        { duration: scurryMs, easing: "ease-in-out", fill: "forwards" }
      );
      anim.onfinish = () => {
        if (!el.isConnected) return;
        el.classList.remove("is-scurrying");
        el.classList.add("is-nibbling");
        if (meta.soundInteract) {
          MashSounds.play(meta.soundInteract);
          window.setTimeout(() => MashSounds.play(meta.soundInteract), 280);
        }
        for (let i = 0; i < 5; i++) {
          const crumb = document.createElement("div");
          crumb.className = "crumb";
          crumb.style.left = `${nibbleX + rand(-12, 12)}px`;
          crumb.style.top = `${nibbleY + rand(-4, 10)}px`;
          crumb.style.setProperty("--dx", `${rand(-10, 14)}px`);
          crumb.style.setProperty("--dy", `${rand(-18, -6)}px`);
          ctx.stage.appendChild(crumb);
          window.setTimeout(() => crumb.remove(), 800);
        }
        window.setTimeout(() => {
          if (!el.isConnected) return;
          el.classList.remove("is-nibbling");
          el.classList.add("is-scurrying");
          MashSounds.play("squeak");
          const outMs = rand(800, 1300);
          const outAnim = MashMotion.animate(
            el,
            [
              { transform: `translate(${nibbleX}px, ${nibbleY}px) scaleX(${face})` },
              { transform: `translate(${exitX}px, ${exitY}px) scaleX(${face})` },
            ],
            { duration: outMs, easing: "ease-in", fill: "forwards" }
          );
          outAnim.onfinish = () => {
            if (el.isConnected) el.remove();
            ctx.spawnCount = Math.max(0, ctx.spawnCount - 1);
          };
        }, 900);
      };
    }, 380);
  }

  function spawnOne(ctx, kind) {
    const meta = MashEntities.meta(kind, ctx.spec.customEntities);
    if (!meta) return null;
    const behavior = meta.behavior || "drop_ready";
    if (behavior === "bake_ready") return spawnBakeReady(ctx, kind, meta);
    if (behavior === "float_pop") return spawnFloatPop(ctx, kind, meta);
    if (behavior === "splash_swim") return spawnSplashSwim(ctx, kind, meta);
    if (behavior === "scurry_nibble") return spawnScurryNibble(ctx, kind, meta);
    return spawnDropReady(ctx, kind, meta);
  }

  function sendActor(ctx, actorDef, treat) {
    const kind = actorDef.kind;
    const meta = MashEntities.meta(kind, ctx.spec.customEntities);
    if (!meta) return;

    ctx.actorCount += 1;
    const fromLeft = Math.random() < 0.5;
    const face = fromLeft ? 1 : -1;
    const width = ctx.root.clientWidth;
    const height = ctx.root.clientHeight;
    const munchX = treat.x + rand(-12, 12);
    const munchY = treat.y + rand(-6, 18);
    const startX = fromLeft ? -80 : width + 80;
    const startY = Math.min(height * 0.78, munchY + rand(40, 90));
    const exitX = fromLeft ? width + 100 : -100;
    const exitY = startY + rand(-20, 40);
    const html =
      kind === "baby"
        ? MashEntities.render("baby")
        : kind === "dino"
          ? MashEntities.render("dino")
          : kind === "puppy"
            ? MashEntities.render("puppy")
            : customHtml(meta);

    const el = makeEl(meta, html, startX, startY, "transform");
    el.classList.add("actor", "is-crawling-in");
    el.style.transform = `translate(${startX}px, ${startY}px) scaleX(${face})`;
    ctx.stage.appendChild(el);
    if (meta.soundArrive) MashSounds.play(meta.soundArrive);

    const crawlInMs = rand(1100, 1600);
    const crawlIn = MashMotion.animate(
      el,
      [
        { transform: `translate(${startX}px, ${startY}px) scaleX(${face})` },
        { transform: `translate(${munchX}px, ${munchY}px) scaleX(${face})` },
      ],
      { duration: crawlInMs, easing: "ease-in-out", fill: "forwards" }
    );

    crawlIn.onfinish = () => {
      if (!treat.el.isConnected) {
        el.remove();
        ctx.actorCount -= 1;
        ctx.maybeSendActor();
        return;
      }
      el.classList.remove("is-crawling-in");
      el.classList.add("is-munching");
      const interact = treat.meta.soundInteract || meta.soundInteract || "munch";
      MashSounds.play(interact);
      window.setTimeout(() => MashSounds.play(interact), 320);
      window.setTimeout(() => MashSounds.play(interact), 640);

      window.setTimeout(() => {
        if (treat.el.isConnected) {
          treat.el.classList.add("is-eaten");
          window.setTimeout(() => {
            if (treat.el.isConnected) treat.el.remove();
          }, 550);
        }
        ctx.treats = ctx.treats.filter((t) => t !== treat);
      }, 770);

      window.setTimeout(() => {
        el.classList.remove("is-munching");
        el.classList.add("is-crawling-out");
        const crawlOut = MashMotion.animate(
          el,
          [
            { transform: `translate(${munchX}px, ${munchY}px) scaleX(${face})` },
            { transform: `translate(${exitX}px, ${exitY}px) scaleX(${face})` },
          ],
          { duration: rand(1000, 1500), easing: "ease-in", fill: "forwards" }
        );
        crawlOut.onfinish = () => {
          el.remove();
          ctx.actorCount -= 1;
          ctx.maybeSendActor();
        };
      }, 1400);
    };
  }

  global.MashSpawn = { spawnOne, sendActor, zoneRect };
})(window);
