const TOKEN_KEY = "af_token";
const USER_KEY = "af_user";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function formatByn(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toLocaleString("ru-BY")} BYN`;
}

function formatUsd(byn, usdPerByn) {
  if (!usdPerByn || !byn) return "";
  const usd = Math.round((Number(byn) * usdPerByn) * 100) / 100;
  return ` · ~${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })} $`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstImage(item) {
  const imgs = item.images;
  if (Array.isArray(imgs) && imgs[0]) return imgs[0];
  return null;
}

let exchangeRate = null;

async function loadExchangeRate() {
  try {
    exchangeRate = await api("/api/exchange-rates");
  } catch {
    exchangeRate = null;
  }
}

function updateAuthUi() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);
  const user = userRaw ? JSON.parse(userRaw) : null;
  const label = $("#auth-label");
  const btnLogin = $("#btn-login");
  const btnLogout = $("#btn-logout");
  if (token && user) {
    label.textContent = user.full_name || user.email || "";
    label.classList.remove("hidden");
    btnLogin.classList.add("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    label.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
  }
}

function setActiveNav(route) {
  $$(".nav a").forEach((a) => {
    const nav = a.dataset.nav;
    a.classList.toggle("active", route === nav || (route === "home" && nav === "home"));
  });
}

async function renderHome(container) {
  setActiveNav("home");
  container.innerHTML = `<section class="hero"><h1>AutoFinder</h1><p>Объявления о продаже автомобилей. Мобильное приложение и веб на одном API.</p></section><div class="loading">Загрузка сводки…</div>`;
  const wrong = container.querySelector(".loading");
  try {
    const [stats, rate] = await Promise.all([
      api("/api/stats"),
      api("/api/exchange-rates").catch(() => null),
    ]);
    exchangeRate = rate;
    const rateHtml = rate
      ? `<p class="rate-banner">Курс НБРБ: <strong>1 BYN = ${Number(rate.usdPerByn).toFixed(4)} USD</strong> (пример: 10 000 BYN ≈ ${rate.example?.usd ?? "—"} $)</p>`
      : "";
    container.innerHTML = `
      <section class="hero">
        <h1>AutoFinder</h1>
        <p>Каталог опубликованных объявлений. Откройте раздел «Объявления» для поиска с фильтрами.</p>
      </section>
      ${rateHtml}
      <div class="stats">
        <div class="stat-card">
          <div class="value">${stats.publishedListings ?? 0}</div>
          <div class="label">Опубликовано</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.aggregated ?? 0}</div>
          <div class="label">Агрегировано</div>
        </div>
        <div class="stat-card">
          <div class="value">${stats.queuePending ?? 0}</div>
          <div class="label">В очереди</div>
        </div>
      </div>
      <p><a href="#/listings" class="btn btn-primary">Смотреть объявления</a></p>
    `;
  } catch (e) {
    wrong.className = "error-msg";
    wrong.textContent = `Не удалось загрузить данные: ${e.message}`;
  }
}

function buildSearchParams(form) {
  const fd = new FormData(form);
  const p = new URLSearchParams();
  p.set("search", "1");
  for (const [k, v] of fd.entries()) {
    const s = String(v).trim();
    if (s) p.set(k, s);
  }
  return p;
}

function listingCardHtml(item) {
  const img = firstImage(item);
  const imgBlock = img
    ? `<img class="card-img" src="${escapeHtml(img)}" alt="" loading="lazy" />`
    : `<div class="card-img placeholder">Нет фото</div>`;
  const usd = formatUsd(item.price_byn, exchangeRate?.usdPerByn);
  const meta = [
    item.year,
    item.mileage_km != null ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км` : null,
    item.city,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <button type="button" class="card" data-id="${escapeHtml(item.id)}">
      ${imgBlock}
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(item.title || `${item.brand || ""} ${item.model || ""}`.trim())}</h3>
        <div class="card-price">${formatByn(item.price_byn)}${usd}</div>
        <div class="card-meta">${escapeHtml(meta)}</div>
      </div>
    </button>
  `;
}

async function openListingDetail(id) {
  const dialog = $("#detail-dialog");
  const body = $("#detail-body");
  body.innerHTML = `<p class="loading">Загрузка…</p>`;
  dialog.showModal();
  try {
    const item = await api(`/api/listings/${encodeURIComponent(id)}`);
    if (!exchangeRate) await loadExchangeRate();
    const imgs = Array.isArray(item.images) ? item.images : [];
    const gallery =
      imgs.length > 0
        ? `<div class="detail-gallery">${imgs.map((u) => `<img src="${escapeHtml(u)}" alt="" />`).join("")}</div>`
        : "";
    const usd = formatUsd(item.price_byn, exchangeRate?.usdPerByn);
    const specs = [
      ["Год", item.year],
      ["Пробег", item.mileage_km != null ? `${item.mileage_km} км` : null],
      ["Город", item.city],
      ["Кузов", item.body_type],
      ["Двигатель", item.fuel_type],
      ["Коробка", item.transmission],
      ["Объём", item.engine_volume_ml ? `${(item.engine_volume_ml / 1000).toFixed(1)} л` : null],
      ["Привод", item.drivetrain],
    ].filter(([, v]) => v != null && v !== "");

    body.innerHTML = `
      <article class="detail">
        ${gallery}
        <h2>${escapeHtml(item.title)}</h2>
        <div class="detail-price">${formatByn(item.price_byn)}${usd}</div>
        <dl class="detail-specs">
          ${specs.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
        </dl>
        ${item.owner_phone ? `<p><strong>Телефон:</strong> <a href="tel:${escapeHtml(item.owner_phone)}">${escapeHtml(item.owner_phone)}</a></p>` : ""}
        ${item.description ? `<p class="detail-desc">${escapeHtml(item.description)}</p>` : ""}
      </article>
    `;
  } catch (e) {
    body.innerHTML = `<p class="error-msg">${escapeHtml(e.message)}</p>`;
  }
}

async function renderListings(container) {
  setActiveNav("listings");
  if (!exchangeRate) await loadExchangeRate();

  container.innerHTML = `
    <h1 class="page-title">Объявления</h1>
    <form id="search-form" class="filters">
      <label>Марка <input name="brand" type="text" autocomplete="off" /></label>
      <label>Модель <input name="model" type="text" autocomplete="off" /></label>
      <label>Год от <input name="yearFrom" type="number" min="1950" max="2030" /></label>
      <label>Год до <input name="yearTo" type="number" min="1950" max="2030" /></label>
      <label>Цена от <input name="priceFrom" type="number" min="0" /></label>
      <label>Цена до <input name="priceTo" type="number" min="0" /></label>
      <label>Валюта
        <select name="currency">
          <option value="byn">BYN</option>
          <option value="usd">USD</option>
        </select>
      </label>
      <label>Поиск <input name="q" type="search" placeholder="текст…" /></label>
      <div class="filter-actions">
        <button type="submit" class="btn btn-primary">Найти</button>
        <button type="reset" class="btn btn-ghost">Сбросить</button>
      </div>
    </form>
    <div id="results"></div>
  `;

  const results = $("#results", container);
  const form = $("#search-form", container);

  async function runSearch() {
    results.innerHTML = `<p class="loading">Поиск…</p>`;
    try {
      const params = buildSearchParams(form);
      const data = await api(`/api/listings?${params}`);
      const items = data.items || [];
      const total = data.total ?? items.length;
      if (items.length === 0) {
        results.innerHTML = `<p class="empty">Объявлений не найдено</p>`;
        return;
      }
      results.innerHTML = `
        <p class="results-meta">Найдено: ${total}</p>
        <div class="grid">${items.map(listingCardHtml).join("")}</div>
      `;
      $$(".card", results).forEach((btn) => {
        btn.addEventListener("click", () => openListingDetail(btn.dataset.id));
      });
    } catch (e) {
      results.innerHTML = `<p class="error-msg">${escapeHtml(e.message)}</p>`;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });
  form.addEventListener("reset", () => {
    setTimeout(runSearch, 0);
  });

  runSearch();
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path] = hash.split("?");
  if (path === "/listings") return { name: "listings" };
  return { name: "home" };
}

async function router() {
  const app = $("#app");
  const route = parseRoute();
  if (route.name === "listings") {
    await renderListings(app);
  } else {
    await renderHome(app);
  }
}

function initDialogs() {
  const loginDialog = $("#login-dialog");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");

  $("#btn-login").addEventListener("click", () => {
    loginError.classList.add("hidden");
    loginDialog.showModal();
  });

  $("#btn-logout").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    updateAuthUi();
  });

  $$("[data-close-dialog]").forEach((el) => {
    el.addEventListener("click", () => {
      el.closest("dialog")?.close();
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    const fd = new FormData(loginForm);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({
          email: data.user?.email,
          full_name: data.user?.full_name,
          role: data.user?.role,
        })
      );
      loginDialog.close();
      updateAuthUi();
    } catch (err) {
      loginError.textContent =
        err.data?.error === "credentials" ? "Неверный email или пароль" : err.message;
      loginError.classList.remove("hidden");
    }
  });
}

window.addEventListener("hashchange", () => router());
updateAuthUi();
initDialogs();
router();
