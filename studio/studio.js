(() => {
  "use strict";

  const landing = document.getElementById("landing");
  const chat = document.getElementById("chat");
  const promptEl = document.getElementById("prompt");
  const createBtn = document.getElementById("create-btn");
  const messages = document.getElementById("messages");
  const tweakForm = document.getElementById("tweak-form");
  const tweakEl = document.getElementById("tweak");
  const usageEl = document.getElementById("usage");
  const emptyStage = document.getElementById("empty-stage");
  const frame = document.getElementById("play-frame");
  const playLink = document.getElementById("play-link");
  const replayBtn = document.getElementById("replay-btn");

  let sessionId = null;
  let busy = false;

  function setBusy(v) {
    busy = v;
    createBtn.disabled = v;
    tweakForm.querySelector("button").disabled = v;
  }

  function addBubble(text, role, meta) {
    const div = document.createElement("div");
    div.className = `bubble bubble--${role}`;
    div.textContent = text;
    if (meta) {
      const m = document.createElement("span");
      m.className = "bubble__meta";
      m.textContent = meta;
      div.appendChild(m);
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function showPlay(id) {
    sessionId = id;
    const url = `/engine/play.html?session=${encodeURIComponent(id)}`;
    frame.src = url;
    frame.hidden = false;
    emptyStage.hidden = true;
    playLink.href = url;
    landing.hidden = true;
    chat.hidden = false;
  }

  function reloadPlay(spec) {
    if (!sessionId) return;
    const win = frame.contentWindow;
    if (win && spec) {
      win.postMessage({ type: "mash:applySpec", spec }, "*");
    } else {
      frame.src = `/engine/play.html?session=${encodeURIComponent(sessionId)}&t=${Date.now()}`;
    }
  }

  function updateUsage(data) {
    const total = (data.usage && data.usage.total_tokens) || 0;
    const turn = data.turn_usage || {};
    const path = turn.path || "—";
    usageEl.textContent = `Tokens: ${total} total · last turn ${turn.total_tokens || 0} (${path})`;
  }

  async function createSessionAndPrompt() {
    const text = promptEl.value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const created = await fetch("/api/session", { method: "POST" }).then((r) => r.json());
      const res = await fetch(`/api/session/${created.id}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      messages.innerHTML = "";
      addBubble(text, "user");
      addBubble(data.note || "Ready!", "bot", data.intent);
      showPlay(data.id);
      updateUsage(data);
      // load after session exists
      frame.src = `/engine/play.html?session=${encodeURIComponent(data.id)}`;
    } catch (err) {
      alert("Could not create game: " + (err.message || err));
    } finally {
      setBusy(false);
    }
  }

  async function sendTweak(ev) {
    ev.preventDefault();
    const text = tweakEl.value.trim();
    if (!text || !sessionId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/tweak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      addBubble(text, "user");
      addBubble(data.note || "Updated!", "bot", `${data.intent}`);
      tweakEl.value = "";
      updateUsage(data);
      reloadPlay(data.spec);
    } catch (err) {
      alert("Tweak failed: " + (err.message || err));
    } finally {
      setBusy(false);
      tweakEl.focus();
    }
  }

  createBtn.addEventListener("click", createSessionAndPrompt);
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) createSessionAndPrompt();
  });
  tweakForm.addEventListener("submit", sendTweak);
  replayBtn.addEventListener("click", () => reloadPlay(null));

  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "mash:exit") {
      // stay in studio; just note it
    }
  });
})();
