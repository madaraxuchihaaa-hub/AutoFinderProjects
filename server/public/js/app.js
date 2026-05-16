import {
  BODY,
  FUEL,
  STATUS,
  TRANS,
  FILTER_DRIVE,
  label,
  normalizeCatalogFilterQuery,
} from "./labels.js";
import { CMP_MAX, createSavedStore } from "./saved.js";
import {
  attrEsc,
  firstImageUrl,
  imgTag,
  parseImagesField,
  resolveMediaUrl,
} from "./media.js";
import {
  collectEquipmentFromForm,
  equipmentDisplayHtml,
  initEquipmentToggle,
  loadEquipmentCatalog,
  parseListingEquipment,
  renderEquipmentPickers,
} from "./equipment.js";

const TOKEN_KEY = "af_token";
const USER_KEY = "af_user";
const PAGE_SIZE = 20;
const THEME_KEY = "af_web_theme";

function initWebTheme() {
  document.documentElement.setAttribute(
    "data-theme",
    localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
  );
}

function setWebTheme(mode) {
  const m = mode === "light" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, m);
  document.documentElement.setAttribute("data-theme", m);
}

initWebTheme();

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let exchangeRate = null;
let brandsCache = null;
let saved = null;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setUser(u, token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  void saved?.refresh().then(() => renderNav());
}

async function api(path, opts = {}) {
  const headers = { Accept: "application/json", ...(opts.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { ...opts, headers });
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
    const err = new Error(data?.message || data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

saved = createSavedStore({ getUser, api });

async function loadRate() {
  if (exchangeRate) return exchangeRate;
  try {
    exchangeRate = await api("/api/exchange-rates");
  } catch {
    exchangeRate = { usdPerByn: 0.31 };
  }
  return exchangeRate;
}

function fmtByn(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toLocaleString("ru-BY")} BYN`;
}

function fmtUsd(byn) {
  const r = exchangeRate?.usdPerByn ?? 0.31;
  const usd = Math.round(Number(byn) * r);
  return usd > 0 ? `≈ ${usd.toLocaleString("ru-BY")} $` : "";
}

function fmtEngineMl(ml) {
  if (ml == null || !Number(ml)) return "—";
  return `${(Number(ml) / 1000).toFixed(1)} л`;
}

function listingParamBits(item) {
  return [
    item.year ? `${item.year} г.` : null,
    label(BODY, item.body_type),
    label(TRANS, item.transmission),
    label(FUEL, item.fuel_type),
    item.drivetrain || null,
    item.engine_volume_ml ? fmtEngineMl(item.engine_volume_ml) : null,
    item.trim_level || null,
    item.color || null,
  ].filter(Boolean);
}

function engineVolumeLiters(item) {
  if (item.engine_volume_ml == null || !Number(item.engine_volume_ml)) return "";
  return String(Number(item.engine_volume_ml) / 1000).replace(/\.0$/, "");
}

/** Все характеристики как в мобильном приложении. */
function listingSpecRows(item) {
  const rows = [
    ["Марка / модель", `${item.brand || ""} ${item.model || ""}`.trim() || "—"],
    ["Год", item.year != null ? String(item.year) : "—"],
    [
      "Пробег",
      item.mileage_km != null
        ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км`
        : "—",
    ],
    ["Комплектация", item.trim_level || "—"],
    ["Топливо", label(FUEL, item.fuel_type)],
    ["КПП", label(TRANS, item.transmission)],
    ["Кузов", label(BODY, item.body_type)],
    ["Привод", item.drivetrain || "—"],
    ["Объём двигателя", item.engine_volume_ml ? fmtEngineMl(item.engine_volume_ml) : "—"],
    ["Цвет", item.color || "—"],
  ];
  if (item.vin) rows.push(["VIN", item.vin]);
  if (item.plate_number) rows.push(["Госномер", item.plate_number]);
  rows.push(["Город", item.city || "—"]);
  return rows;
}

function specsGridHtml(rows) {
  return `<dl class="ls-av__specs ls-av__specs--full">${rows
    .map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`)
    .join("")}</dl>`;
}

function fmtDt(s) {
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${mi}`;
}

function parseRoute() {
  const hash = location.hash.replace(/^#/, "") || "/home";
  const [path, qs] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  if (parts[0] === "home") return { page: "home", query };
  if (parts[0] === "feed" && parts[1]) return { page: "feed", id: parts[1], query };
  if (parts[0] === "settings") return { page: "settings", query };
  if (parts[0] === "admin") return { page: "admin", query };
  if (parts[0] === "staff" && parts[1]) return { page: "staff-review", id: parts[1], query };
  if (parts[0] === "staff") return { page: "staff", query };
  if (parts[0] === "listings" && parts[1]) return { page: "listing", id: parts[1], query };
  if (parts[0] === "listings") return { page: "listings", query };
  if (parts[0] === "login") return { page: "login", query };
  if (parts[0] === "register") return { page: "register", query };
  if (parts[0] === "help") return { page: "help", query };
  if (parts[0] === "compare") return { page: "compare", query };
  if (parts[0] === "messages") return { page: "messages", query };
  if (parts[0] === "profile") return { page: "profile", query };
  if (parts[0] === "favorites") return { page: "favorites", query };
  if (parts[0] === "my-listings") return { page: "my-listings", query };
  if (parts[0] === "create") return { page: "create-listing", query };
  return { page: "home", query };
}

function navHref(path) {
  return `#${path}`;
}

function renderNav() {
  const nav = $("#site-nav");
  if (!nav) return;
  const user = getUser();
  const cmp = saved?.compareCount ?? 0;
  let html = `
    <a href="${navHref("/home")}">Главная</a>
    <a href="${navHref("/listings")}">Каталог</a>
    <a href="${navHref("/compare")}">Сравнение${cmp ? ` (${cmp})` : ""}</a>
    <a href="${navHref("/help")}">Справка</a>
  `;
  if (user) {
    html += `
      <a href="${navHref("/profile")}">Профиль</a>
      <a href="${navHref("/my-listings")}">Мои объявления</a>
      <a class="nav-cta" href="#/create">Подать объявление</a>
      <a href="${navHref("/favorites")}">Избранное</a>
      <a href="${navHref("/messages")}">Сообщения</a>
      <a href="${navHref("/settings")}">Тема</a>
    `;
    if (user.role === "moderator") {
      html += `<a href="${navHref("/staff")}">Модерация</a>`;
    }
    if (user.role === "admin") {
      html += `<a href="${navHref("/admin")}">Админ-панель</a>`;
    }
    html += `<button type="button" class="linkish" id="btn-logout">Выйти (${esc(user.full_name || user.email)})</button>`;
  } else {
    html += `
      <a href="${navHref("/settings")}">Тема</a>
      <a href="${navHref("/login")}">Вход</a>
      <a href="${navHref("/register")}">Регистрация</a>
    `;
  }
  nav.innerHTML = html;
  const lo = $("#btn-logout");
  if (lo) {
    lo.addEventListener("click", () => {
      setUser(null, null);
      location.hash = "#/home";
    });
  }
}

function catalogCard(item, opts = {}) {
  const img = firstImageUrl(item);
  const isFav = saved?.isFavorite(item.id);
  const isCmp = saved?.isCompared(item.id);
  const user = getUser();
  const pBits = listingParamBits(item);
  const title = item.title || `${item.brand || ""} ${item.model || ""}`.trim();
  const status = STATUS[item.status] || item.status || "—";
  return `
    <article class="catalog-card" data-id="${esc(item.id)}">
      <div class="catalog-card__shell">
        <a href="#/listings/${esc(item.id)}" class="catalog-card__link">
          <div class="catalog-card__photo">
            ${
              img
                ? imgTag(img, title, "catalog-card__img")
                : `<div class="catalog-card__ph-empty">Нет фото</div>`
            }
            <div class="catalog-card__badgebar">
              <span class="catalog-card__badge">${esc(status)}</span>
            </div>
          </div>
          <div class="catalog-card__summary">
            <h2 class="catalog-card__title">${esc(item.brand)} ${esc(item.model)}</h2>
            <div class="catalog-card__prices">
              <span class="catalog-card__p1">${fmtByn(item.price_byn)}</span>
              <span class="catalog-card__p2">${fmtUsd(item.price_byn)}</span>
            </div>
            <p class="catalog-card__params">
              ${esc(pBits.join(", "))}
              ${pBits.length ? '<span class="catalog-card__dot">•</span>' : ""}
              <strong>${item.mileage_km != null ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км` : "—"}</strong>
            </p>
            <p class="catalog-card__loc">${esc(item.city || "—")}</p>
            <dl class="catalog-card__specs">${listingSpecRows(item)
              .slice(0, 6)
              .map(
                ([dt, dd]) =>
                  `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`
              )
              .join("")}</dl>
          </div>
        </a>
        ${
          user
            ? `<form class="catalog-card__favorite-form" data-fav="${esc(item.id)}">
            <button type="button" class="catalog-card__favorite${isFav ? " is-active" : ""}" data-fav-btn>
              ${isFav ? "В избранном" : "В избранное"}
            </button>
          </form>`
            : ""
        }
        <form class="catalog-card__compare-form" data-cmp="${esc(item.id)}">
          <button type="button" class="catalog-card__compare${isCmp ? " is-active" : ""}" data-cmp-btn>
            ${isCmp ? "В сравнении" : "Сравнить"}
          </button>
        </form>
      </div>
    </article>
  `;
}

function bindCardActions(root) {
  $$("[data-fav-btn]", root).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id =
        btn.getAttribute("data-fav") || btn.closest("[data-fav]")?.getAttribute("data-fav");
      if (!id) return;
      void saved
        ?.toggleFavorite(id)
        .then((on) => {
          btn.classList.toggle("is-active", on);
          btn.textContent = on ? "В избранном" : "В избранное";
        })
        .catch(() => {
          if (!getUser()) location.hash = "#/login";
        });
    });
  });
  $$("[data-cmp-btn]", root).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id =
        btn.getAttribute("data-cmp") || btn.closest("[data-cmp]")?.getAttribute("data-cmp");
      if (!id) return;
      void saved
        ?.toggleCompare(id)
        .then((on) => {
          btn.classList.toggle("is-active", on);
          btn.textContent = on ? "В сравнении" : "Сравнить";
          renderNav();
        })
        .catch((err) => {
          if (err?.message === "limit") {
            alert(`В сравнении не больше ${CMP_MAX} объявлений.`);
            return;
          }
          if (!getUser()) location.hash = "#/login";
        });
    });
  });
}

async function fetchBrands() {
  if (brandsCache) return brandsCache;
  brandsCache = await api("/api/vehicles/brands?limit=100");
  return brandsCache;
}

function buildListParams(q) {
  const p = new URLSearchParams();
  p.set("search", "1");
  if (q.q) p.set("q", q.q);
  if (q.brand) p.set("brand", q.brand);
  if (q.model) p.set("model", q.model);
  if (q.price_min) p.set("price_from", q.price_min);
  if (q.price_max) p.set("price_to", q.price_max);
  if (q.year_min) p.set("year_from", q.year_min);
  if (q.year_max) p.set("year_to", q.year_max);
  if (q.fuel) p.set("fuel_type", q.fuel);
  if (q.body) p.set("body_type", q.body);
  if (q.transmission) p.set("transmission", q.transmission);
  if (q.city) p.set("q", [q.q, q.city].filter(Boolean).join(" "));
  if (q.generation) p.set("generation", q.generation);
  if (q.volume_from) p.set("volume_from", q.volume_from);
  if (q.volume_to) p.set("volume_to", q.volume_to);
  if (q.drivetrain) p.set("drivetrain", q.drivetrain);
  if (q.currency) p.set("currency", q.currency);
  p.set("limit", String(PAGE_SIZE));
  p.set("offset", String(((Number(q.page) || 1) - 1) * PAGE_SIZE));
  return p;
}

async function pageListings(query) {
  query = normalizeCatalogFilterQuery(query);
  await loadRate();
  const app = $("#app");
  document.title = "Каталог — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;

  const [brands, data] = await Promise.all([
    fetchBrands().catch(() => []),
    api(`/api/listings?${buildListParams(query)}`),
  ]);

  let items = data.items || [];
  if (query.has_photo) items = items.filter((i) => firstImageUrl(i));
  const total = query.has_photo ? items.length : (data.total ?? items.length);
  const withPhotos = items.filter((i) => firstImageUrl(i)).length;
  const page = Number(query.page) || 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const optList = (vals, sel) =>
    vals.map((v) => `<option value="${esc(v)}" ${sel === v ? "selected" : ""}>${esc(v)}</option>`).join("");
  const fuelOpts = `<option value="">—</option>${Object.entries(FUEL)
    .map(([k, v]) => `<option value="${esc(k)}" ${query.fuel === k ? "selected" : ""}>${esc(v)}</option>`)
    .join("")}`;
  const bodyOpts = `<option value="">—</option>${Object.entries(BODY)
    .map(([k, v]) => `<option value="${esc(k)}" ${query.body === k ? "selected" : ""}>${esc(v)}</option>`)
    .join("")}`;
  const transOpts = `<option value="">—</option>${Object.entries(TRANS)
    .map(([k, v]) => `<option value="${esc(k)}" ${query.transmission === k ? "selected" : ""}>${esc(v)}</option>`)
    .join("")}`;
  const driveOpts = optList(FILTER_DRIVE, query.drivetrain);
  const brandOpts = brands
    .map((b) => `<option value="${esc(b.name)}" ${query.brand === b.name ? "selected" : ""}>${esc(b.name)}</option>`)
    .join("");

  app.innerHTML = `
    <section class="hero hero-catalog card">
      <div class="hero-catalog__main">
        <p class="hero-kicker">AutoFinder</p>
        <h1>Каталог автомобилей и мототехники</h1>
      </div>
      <div class="hero-catalog__stats">
        <div class="hero-stat"><span class="hero-stat__label">Найдено</span><strong class="hero-stat__value">${total}</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">Марок</span><strong class="hero-stat__value">${brands.length}</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">С фото в выдаче</span><strong class="hero-stat__value">${withPhotos}</strong></div>
      </div>
    </section>

    <datalist id="catalog-volume-presets">
      <option value="1.0"></option>
      <option value="1.2"></option>
      <option value="1.4"></option>
      <option value="1.5"></option>
      <option value="1.6"></option>
      <option value="1.8"></option>
      <option value="2.0"></option>
      <option value="2.5"></option>
      <option value="3.0"></option>
      <option value="3.5"></option>
      <option value="4.0"></option>
    </datalist>
    <form class="filters card" id="search-form">
      <div class="filters-grid">
        <label><span>Текст</span><input type="search" name="q" value="${esc(query.q || "")}" placeholder="Например: Toyota седан" /></label>
        <label><span>Марка</span><select name="brand" id="filter-brand"><option value="">—</option>${brandOpts}</select></label>
        <label><span>Модель</span><input type="text" name="model" id="filter-model" value="${esc(query.model || "")}" placeholder="Модель" /></label>
        <label><span>Цена от</span><input type="number" name="price_min" min="0" step="1000" value="${esc(query.price_min || "")}" /></label>
        <label><span>Цена до</span><input type="number" name="price_max" min="0" step="1000" value="${esc(query.price_max || "")}" /></label>
        <label><span>Год от</span><input type="number" name="year_min" min="1950" max="2100" value="${esc(query.year_min || "")}" /></label>
        <label><span>Год до</span><input type="number" name="year_max" min="1950" max="2100" value="${esc(query.year_max || "")}" /></label>
        <label><span>Топливо</span><select name="fuel">${fuelOpts}</select></label>
        <label><span>Кузов</span><select name="body">${bodyOpts}</select></label>
        <label><span>Коробка</span><select name="transmission">${transOpts}</select></label>
        <label><span>Привод</span><select name="drivetrain"><option value="">—</option>${driveOpts}</select></label>
        <label><span>Поколение</span><input type="text" name="generation" value="${esc(query.generation || "")}" placeholder="рестайлинг" /></label>
        <label><span>Объём от, л</span><input type="number" name="volume_from" min="0" step="0.1" list="catalog-volume-presets" value="${esc(query.volume_from || "")}" /></label>
        <label><span>Объём до, л</span><input type="number" name="volume_to" min="0" step="0.1" list="catalog-volume-presets" value="${esc(query.volume_to || "")}" /></label>
        <label><span>Валюта цены</span><select name="currency"><option value="byn" ${query.currency !== "usd" ? "selected" : ""}>BYN</option><option value="usd" ${query.currency === "usd" ? "selected" : ""}>USD</option></select></label>
        <label><span>Город</span><input type="text" name="city" value="${esc(query.city || "")}" placeholder="Минск" /></label>
        <label class="filter-toggle"><span>Медиа</span>
          <span class="filter-toggle__box">
            <input type="checkbox" name="has_photo" value="1" ${query.has_photo ? "checked" : ""} /> Только с фото
          </span>
        </label>
      </div>
      <div class="filters-actions">
        <button type="submit">Найти</button>
        <a class="button ghost" href="#/listings">Сбросить</a>
      </div>
    </form>

    <div class="catalog-grid">${items.length ? items.map((i) => catalogCard(i)).join("") : ""}</div>
    ${total === 0 ? '<p class="empty">Объявлений пока нет. Зарегистрируйтесь и разместите первое.</p>' : ""}
    ${totalPages > 1 ? renderPagination(page, totalPages, query) : ""}
  `;

  bindCardActions(app);
  const form = $("#search-form", app);
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const q = {};
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim();
      if (s) q[k] = s;
    }
    if (fd.get("has_photo")) q.has_photo = "1";
    location.hash = `#/listings?${new URLSearchParams(q)}`;
  });

  const brandEl = $("#filter-brand", app);
  brandEl?.addEventListener("change", async () => {
    const modelEl = $("#filter-model", app);
    if (!modelEl || !brandEl.value) return;
    try {
      const models = await api(`/api/vehicles/models?brand=${encodeURIComponent(brandEl.value)}&limit=80`);
      if (models[0]?.name && !modelEl.value) modelEl.placeholder = models[0].name;
    } catch {
      /* ignore */
    }
  });
}

function renderPagination(page, totalPages, query) {
  let html = '<nav class="pagination">';
  for (let p = 1; p <= Math.min(totalPages, 12); p++) {
    const q = { ...query };
    if (p > 1) q.page = String(p);
    else delete q.page;
    const qs = new URLSearchParams(q).toString();
    const url = `#/listings?${qs}`;
    html +=
      p === page
        ? `<span class="current">${p}</span>`
        : `<a href="${url}">${p}</a>`;
  }
  html += "</nav>";
  return html;
}

async function probeListingImages(av, urls) {
  if (!urls.length) return;
  const hint = av.querySelector("#listing-images-hint");
  if (!hint) return;
  try {
    const res = await fetch(urls[0], { method: "HEAD", cache: "no-store" });
    if (!res.ok) hint.hidden = false;
  } catch {
    hint.hidden = false;
  }
}

function initListingDetail(root) {
  const av = root.querySelector("#listing-av-card");
  if (!av) return;
  const stageImg = av.querySelector(".ls-av__stage-img");
  const urls = [...av.querySelectorAll(".ls-av__stage-img, .ls-av__thumb")]
    .map((el) => el.getAttribute("src"))
    .filter(Boolean);
  void probeListingImages(av, urls);
  av.querySelectorAll(".ls-av__nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-src");
      if (src && stageImg) stageImg.setAttribute("src", src);
      av.querySelectorAll(".ls-av__nav-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });
  const phoneBtn = av.querySelector(".js-show-phone");
  const phoneBox = av.querySelector("#listing-phone-reveal");
  if (phoneBtn && phoneBox) {
    phoneBtn.addEventListener("click", () => {
      const can = phoneBtn.getAttribute("data-phone-visible") === "1";
      const phone = phoneBtn.getAttribute("data-phone") || "";
      phoneBox.hidden = false;
      phoneBox.textContent =
        can && phone
          ? `Телефон продавца: ${phone}`
          : phoneBtn.getAttribute("data-phone-missing-text") || "Номер скрыт";
    });
  }
  const loanRoot = av.querySelector("[data-loan-calc]");
  if (loanRoot) {
    const price = Number(loanRoot.getAttribute("data-price") || "0");
    const downEl = loanRoot.querySelector("[data-loan-down]");
    const termEl = loanRoot.querySelector("[data-loan-term]");
    const rateEl = loanRoot.querySelector("[data-loan-rate]");
    const amountOut = loanRoot.querySelector("[data-loan-amount]");
    const paymentOut = loanRoot.querySelector("[data-loan-payment]");
    const overpayOut = loanRoot.querySelector("[data-loan-overpay]");
    const fmt = (v) =>
      `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.max(0, v))} BYN`;
    const renderLoan = () => {
      const down = Math.max(0, Number(downEl?.value || 0));
      const term = Math.max(1, Number(termEl?.value || 1));
      const rateYear = Math.max(0, Number(rateEl?.value || 0));
      let principal = Math.max(0, price - down);
      const monthRate = rateYear / 12 / 100;
      let payment = 0;
      if (principal <= 0) payment = 0;
      else if (monthRate <= 0) payment = principal / term;
      else {
        const factor = Math.pow(1 + monthRate, term);
        payment = (principal * monthRate * factor) / (factor - 1);
      }
      const total = payment * term;
      if (amountOut) amountOut.textContent = fmt(principal);
      if (paymentOut) paymentOut.textContent = fmt(payment);
      if (overpayOut) overpayOut.textContent = fmt(Math.max(0, total - principal));
    };
    [downEl, termEl, rateEl].forEach((el) => el?.addEventListener("input", renderLoan));
    renderLoan();
  }
  bindCardActions(root);
  const msgForm = root.querySelector("#listing-msg-form");
  if (msgForm) {
    msgForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = new FormData(msgForm).get("body")?.toString().trim();
      const listingId = msgForm.getAttribute("data-listing-id");
      if (!body || !listingId) return;
      try {
        const conv = await api("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ listing_id: listingId }),
        });
        await api(`/api/conversations/${conv.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        location.hash = `#/messages?conv=${conv.id}`;
      } catch (err) {
        alert(err.message || "Не удалось отправить");
      }
    });
  }
}

async function pageListing(id) {
  await loadRate();
  const app = $("#app");
  document.title = "Объявление — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const item = await api(`/api/listings/${encodeURIComponent(id)}`);
  await loadEquipmentCatalog(api);
  const eqSections = parseListingEquipment(item);
  const equipmentHtml = equipmentDisplayHtml(eqSections, esc);
  const user = getUser();
  const imgs = parseImagesField(item.images)
    .map((p) => resolveMediaUrl(p))
    .filter(Boolean);
  const mainSrc = imgs[0] || null;
  const paramLine = listingParamBits(item).join(", ");
  const sideSpecs = listingSpecRows(item)
    .slice(0, 8)
    .map(([dt, dd]) => `<div class="ls-av__side-spec"><span>${esc(dt)}</span><strong>${esc(dd)}</strong></div>`)
    .join("");
  const isFav = saved?.isFavorite(item.id);
  const isCmp = saved?.isCompared(item.id);
  const canPhone = item.owner_phone && item.show_phone;
  const updated = item.updated_at || item.created_at;
  const navBtns =
    imgs.length > 1
      ? `<div class="ls-av__nav" role="tablist">${imgs
          .map(
            (p, i) =>
              `<button type="button" class="ls-av__nav-btn${i === 0 ? " is-active" : ""}" data-src="${attrEsc(p)}" aria-label="Фото ${i + 1}">${imgTag(p, "", "ls-av__thumb")}</button>`
          )
          .join("")}</div>`
      : "";

  const specRows = listingSpecRows(item);

  app.innerHTML = `
    ${item.status === "moderation" ? '<p class="banner banner-warn">Объявление на модерации — в каталоге появится после проверки.</p>' : ""}
    <p class="banner banner-warn" id="listing-images-hint" hidden>Файлы фото не найдены — загрузите снова в приложении.</p>
    ${item.reject_reason ? `<p class="banner banner-warn">${esc(item.reject_reason)}</p>` : ""}
    <div class="ls-av" id="listing-av-card">
      <header class="ls-av__top">
        <h1 class="ls-av__title">${esc(item.title)}</h1>
        <p class="ls-av__title-sub">${esc(label(FUEL, item.fuel_type))} · ${esc(label(TRANS, item.transmission))} · ${esc(label(BODY, item.body_type))}</p>
        <div class="ls-av__meta-line muted small">
          <span>Обновлено: ${updated ? esc(fmtDt(updated).split(" ")[0]) : "—"}</span>
          <span>Статус: ${esc(STATUS[item.status] || item.status)}</span>
        </div>
      </header>
      <div class="ls-av__wrap">
        <div class="ls-av__gallery">
          <div class="ls-av__stage">
            ${
              mainSrc
                ? imgTag(mainSrc, item.title, "ls-av__stage-img")
                : `<div class="ls-av__stage-placeholder">Нет фотографий</div>`
            }
          </div>
          ${navBtns}
        </div>
        <aside class="ls-av__side">
          <div class="ls-av__side-inner">
            <div class="ls-av__prices">
              <div class="ls-av__price-primary"><span class="ls-av__price-value">${esc(fmtByn(item.price_byn).replace(" BYN", ""))}</span><span class="ls-av__price-cur">BYN</span></div>
              <div class="ls-av__price-secondary">${fmtUsd(item.price_byn)}</div>
            </div>
            <p class="ls-av__params">${esc(paramLine)}${paramLine ? ", " : ""}<strong>${item.mileage_km != null ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км` : "—"}</strong></p>
            <div class="ls-av__side-specs">${sideSpecs}</div>
            <div class="ls-av__footer-meta">
              <div class="ls-av__location">${esc(item.city || "—")}</div>
            </div>
          </div>
          <div class="ls-av__actions">
            <button type="button" class="ls-av__btn ls-av__btn--ghost${isFav ? " is-active" : ""}" data-fav-btn data-fav="${esc(item.id)}">${isFav ? "Убрать из избранного" : "Добавить в избранное"}</button>
            <button type="button" class="ls-av__btn ls-av__btn--ghost${isCmp ? " is-active" : ""}" data-cmp-btn data-cmp="${esc(item.id)}">${isCmp ? "Убрать из сравнения" : "Добавить к сравнению"}</button>
            <button type="button" class="ls-av__btn ls-av__btn--primary js-show-phone" data-phone="${esc(canPhone ? item.owner_phone : "")}" data-phone-visible="${canPhone ? "1" : "0"}" data-phone-missing-text="Продавец скрыл номер телефона в объявлении">Позвонить продавцу</button>
            ${user ? `<a class="ls-av__btn ls-av__btn--ghost" href="#/messages?listing=${esc(item.id)}">Открыть сообщения</a>` : ""}
          </div>
          <div class="ls-av__phone muted small" id="listing-phone-reveal" hidden></div>
        </aside>
      </div>
      ${equipmentHtml}
      <div class="ls-av__panels ls-av__panels--specs">
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Характеристики</h2>
          ${specsGridHtml(specRows)}
        </section>
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Описание</h2>
          <div class="ls-av__description">${esc(item.description || "—").replace(/\n/g, "<br />")}</div>
        </section>
      </div>
      <div class="ls-av__panels">
        <section class="ls-av__panel">
          <h2 class="ls-av__panel-title">Калькулятор платежа</h2>
          <div class="loan-calc" data-loan-calc data-price="${Number(item.price_byn) || 0}">
            <label><span>Первый взнос, BYN</span><input type="number" min="0" step="100" class="loan-calc__input" data-loan-down value="${Math.round((Number(item.price_byn) || 0) * 0.2)}" /></label>
            <label><span>Срок, месяцев</span><input type="number" min="6" max="120" class="loan-calc__input" data-loan-term value="60" /></label>
            <label><span>Ставка, % годовых</span><input type="number" min="0.1" max="60" step="0.1" class="loan-calc__input" data-loan-rate value="14.5" /></label>
            <div class="loan-calc__summary">
              <div><span class="muted small">Сумма кредита</span><strong data-loan-amount>0 BYN</strong></div>
              <div><span class="muted small">Ежемесячный платёж</span><strong data-loan-payment>0 BYN</strong></div>
              <div><span class="muted small">Переплата</span><strong data-loan-overpay>0 BYN</strong></div>
            </div>
            <p class="muted small">Ориентировочно; итог — в банке.</p>
          </div>
        </section>
      </div>
      ${
        item.owner_name
          ? `<div class="ls-av__panels"><section class="ls-av__panel"><h2 class="ls-av__panel-title">Продавец</h2><div class="seller-card"><div class="seller-card__avatar"><span>${esc((item.owner_name || "?")[0])}</span></div><div class="seller-card__body"><h3>${esc(item.owner_name)}</h3><p class="muted small">${esc(item.owner_phone ? "Телефон по кнопке выше" : "Телефон скрыт")}</p></div></div></section></div>`
          : ""
      }
      ${
        user
          ? `<section class="ls-av__equipment"><h2 class="ls-av__panel-title">Сообщение продавцу</h2><form class="message-compose" id="listing-msg-form" data-listing-id="${esc(item.id)}"><textarea name="body" rows="3" required maxlength="2000" placeholder="Здравствуйте! Интересует ваш автомобиль…"></textarea><button type="submit">Отправить сообщение</button></form></section>`
          : ""
      }
    </div>
  `;
  initListingDetail(app);
  initEquipmentToggle(app);
}

async function pageCreateListing(editId) {
  const user = getUser();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  const isEdit = Boolean(editId);
  const catalog = await loadEquipmentCatalog(api);
  const app = $("#app");
  document.title = isEdit ? "Редактировать объявление — AutoFinder" : "Новое объявление — AutoFinder";
  let initial = null;
  if (isEdit) {
    app.innerHTML = `<p class="loading">Загрузка…</p>`;
    initial = await api(`/api/listings/${encodeURIComponent(editId)}`);
  }
  app.innerHTML = `
    <section class="hero hero-catalog card">
      <div class="hero-catalog__main">
        <p class="hero-kicker">Продажа</p>
        <h1>${isEdit ? "Редактировать объявление" : "Подать объявление"}</h1>
      </div>
    </section>
    <form class="card stack create-listing" id="create-listing-form">
      <p class="error hidden" id="create-err"></p>
      <label>Заголовок<input name="title" required maxlength="200" placeholder="BMW 320i, один владелец" /></label>
      <div class="filter-grid">
        <label>Марка<input name="brand" required placeholder="BMW" list="brand-list" /></label>
        <label>Модель<input name="model" required placeholder="320i" /></label>
        <label>Год<input name="year" type="number" required min="1990" max="2030" /></label>
        <label>Цена, BYN<input name="price_byn" type="number" required min="1" /></label>
        <label>Пробег, км<input name="mileage_km" type="number" min="0" /></label>
        <label>Город<input name="city" placeholder="Минск" /></label>
        <label>Топливо<select name="fuel_type"><option value="">—</option>${Object.entries(FUEL).map(([k,v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("")}</select></label>
        <label>КПП<select name="transmission"><option value="">—</option>${Object.entries(TRANS).map(([k,v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("")}</select></label>
        <label>Кузов<select name="body_type"><option value="">—</option>${Object.entries(BODY).map(([k,v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("")}</select></label>
        <label>Объём двигателя, л<input name="engine_volume_l" type="number" min="0.5" max="10" step="0.1" placeholder="2.0" /></label>
        <label>Привод<select name="drivetrain"><option value="">—</option>${FILTER_DRIVE.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></label>
        <label>Цвет<input name="color" placeholder="Чёрный" maxlength="60" /></label>
        <label>VIN<input name="vin" placeholder="17 символов" maxlength="17" /></label>
        <label>Госномер<input name="plate_number" placeholder="1234 AB-7" /></label>
      </div>
      <fieldset class="eq-block">
        <legend>Комплектация и опции</legend>
        <div id="equipment-pickers"></div>
      </fieldset>
      <label>Описание<textarea name="description" rows="4" maxlength="4000" placeholder="История, состояние…"></textarea></label>
      <label class="checkbox-row"><input type="checkbox" name="show_phone" checked /> Показывать телефон в объявлении</label>
      <label>Фото (URL, по одному в строке)<textarea name="image_urls" rows="3" placeholder="https://… или загрузите в приложении"></textarea></label>
      <button type="submit" class="button">${isEdit ? "Сохранить" : "Отправить на модерацию"}</button>
    </form>
  `;
  const pickers = $("#equipment-pickers");
  if (pickers) {
    renderEquipmentPickers(pickers, catalog, esc, {
      trim_level: initial?.trim_level,
      equipment: initial?.equipment,
    });
    if (initial) {
      const form = $("#create-listing-form");
      if (form) {
        form.title.value = initial.title || "";
        form.brand.value = initial.brand || "";
        form.model.value = initial.model || "";
        form.year.value = initial.year ?? "";
        form.price_byn.value = initial.price_byn ?? "";
        form.mileage_km.value = initial.mileage_km ?? "";
        form.city.value = initial.city || "";
        form.description.value = initial.description || "";
        form.plate_number.value = initial.plate_number || "";
        form.show_phone.checked = initial.show_phone !== false;
        if (initial.fuel_type) form.fuel_type.value = initial.fuel_type;
        if (initial.transmission) form.transmission.value = initial.transmission;
        if (initial.body_type) form.body_type.value = initial.body_type;
        const evL = engineVolumeLiters(initial);
        if (evL && form.engine_volume_l) form.engine_volume_l.value = evL;
        if (initial.drivetrain && form.drivetrain) form.drivetrain.value = initial.drivetrain;
        if (initial.color && form.color) form.color.value = initial.color;
        if (initial.vin && form.vin) form.vin.value = initial.vin;
        form.image_urls.value = Array.isArray(initial.images) ? initial.images.join("\n") : "";
      }
    }
  }
  $("#create-listing-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#create-err");
    const fd = new FormData(e.target);
    const eq = collectEquipmentFromForm(pickers);
    const image_urls = String(fd.get("image_urls") || "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    try {
      const payload = {
          title: String(fd.get("title") || "").trim(),
          brand: String(fd.get("brand") || "").trim(),
          model: String(fd.get("model") || "").trim(),
          year: Number(fd.get("year")),
          price_byn: Number(fd.get("price_byn")),
          mileage_km: fd.get("mileage_km") ? Number(fd.get("mileage_km")) : undefined,
          city: String(fd.get("city") || "").trim() || undefined,
          fuel_type: String(fd.get("fuel_type") || "") || undefined,
          transmission: String(fd.get("transmission") || "") || undefined,
          body_type: String(fd.get("body_type") || "") || undefined,
          engine_volume_l: fd.get("engine_volume_l") ? Number(fd.get("engine_volume_l")) : undefined,
          drivetrain: String(fd.get("drivetrain") || "").trim() || undefined,
          color: String(fd.get("color") || "").trim() || undefined,
          vin: String(fd.get("vin") || "").trim() || undefined,
          plate_number: String(fd.get("plate_number") || "").trim() || undefined,
          description: String(fd.get("description") || "").trim() || undefined,
          show_phone: fd.get("show_phone") === "on",
          trim_level: eq.trim_level,
          equipment: eq.equipment,
          image_urls,
      };
      if (isEdit) {
        await api(`/api/listings/${encodeURIComponent(editId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/listings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      location.hash = "#/my-listings";
    } catch (ex) {
      if (err) {
        err.textContent = ex.message || "Не удалось сохранить";
        err.classList.remove("hidden");
      }
    }
  });
}

async function pageLogin() {
  const app = $("#app");
  document.title = "Вход — AutoFinder";
  app.innerHTML = `
    <section class="card narrow">
      <h1>Вход</h1>
      <p class="error hidden" id="auth-err"></p>
      <form class="stack" id="login-form">
        <label>Email<input type="email" name="email" required autocomplete="username" /></label>
        <label>Пароль<input type="password" name="password" required autocomplete="current-password" /></label>
        <button type="submit">Войти</button>
      </form>
      <p class="muted"><a href="#/register">Нет аккаунта — зарегистрируйтесь</a></p>
    </section>
  `;
  $("#login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = $("#auth-err");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      setUser(data.user, data.accessToken);
      location.hash = "#/home";
    } catch (ex) {
      err.classList.remove("hidden");
      err.textContent =
        ex.data?.error === "credentials" ? "Неверный email или пароль." : ex.message;
    }
  });
}

async function pageRegister() {
  const app = $("#app");
  document.title = "Регистрация — AutoFinder";
  app.innerHTML = `
    <section class="card narrow">
      <h1>Регистрация</h1>
      <p class="error hidden" id="auth-err"></p>
      <form class="stack" id="reg-form">
        <label>Имя<input type="text" name="full_name" required maxlength="120" /></label>
        <label>Email<input type="email" name="email" required autocomplete="email" /></label>
        <label>Телефон<input type="text" name="phone" maxlength="32" placeholder="+375…" /></label>
        <label>Пароль (от 8 символов)<input type="password" name="password" required minlength="8" autocomplete="new-password" /></label>
        <button type="submit">Создать аккаунт</button>
      </form>
      <p class="muted"><a href="#/login">Уже есть аккаунт</a></p>
    </section>
  `;
  $("#reg-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = $("#auth-err");
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fd.get("full_name"),
          email: fd.get("email"),
          phone: fd.get("phone") || undefined,
          password: fd.get("password"),
        }),
      });
      setUser(data.user, data.accessToken);
      location.hash = "#/home";
    } catch (ex) {
      err.classList.remove("hidden");
      err.textContent = ex.data?.message || ex.message;
    }
  });
}

function pageHelp() {
  document.title = "Справка — AutoFinder";
  $("#app").innerHTML = `
    <section class="hero hero-catalog card">
      <div class="hero-catalog__main">
        <p class="hero-kicker">Справка</p>
        <h1>Как пользоваться AutoFinder</h1>
      </div>
    </section>
    <section class="card help-section"><h2>1. Как найти подходящий автомобиль</h2><ol><li>Откройте <a href="#/listings">каталог</a>.</li><li>Задайте марку, модель, цену, год, тип кузова и другие фильтры.</li><li>Включите фильтр «Только с фото».</li><li>Откройте карточку объявления для описания, фотографий и контактов.</li></ol></section>
    <section class="card help-section"><h2>2. Как связаться с продавцом</h2><ul><li>Если продавец разрешил показ телефона — кнопка «Позвонить продавцу».</li><li>Напишите через форму сообщения на странице объявления (нужен вход).</li><li>Все переписки — в разделе «Сообщения».</li></ul></section>
    <section class="card help-section"><h2>3. Как разместить объявление</h2><ol><li>Зарегистрируйтесь или войдите.</li><li>Подайте объявление на сайте (<a href="#/create">форма</a>) или в мобильном приложении.</li><li>После сохранения объявление может перейти на модерацию.</li></ol></section>
    <section class="card help-section"><h2>4. Избранное и сравнение</h2><ul><li>После входа избранное и сравнение (до ${CMP_MAX} авто) синхронизируются с мобильным приложением.</li><li>Без входа данные хранятся только в этом браузере.</li><li>Калькулятор платежа на странице объявления — ориентировочный.</li></ul></section>
    <section class="card help-section"><h2>5. Модерация и админ</h2><p>Модераторы обрабатывают заявки на <a href="#/staff">странице модерации</a>. Администраторы пользуются <a href="#/admin">админ-панелью</a> на сайте: модерация, пользователи и поиск по всем объявлениям.</p></section>
  `;
}

async function pageHome() {
  await loadRate();
  const app = $("#app");
  document.title = "Главная — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  let stats = null;
  let featured = [];
  let err = "";
  try {
    const [s, a] = await Promise.all([api("/api/stats"), api("/api/aggregated?limit=8")]);
    stats = s;
    featured = Array.isArray(a) ? a : [];
  } catch (e) {
    err = e.message || "Нет связи с API";
  }
  const cards = featured.length
    ? featured
        .map((item) => {
          const raw = item.image_urls;
          const urls = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
          const src = urls[0] ? resolveMediaUrl(String(urls[0])) : "";
          const ph = src
            ? imgTag(src, item.title || "", "home-mini__img")
            : `<div class="home-mini-ph muted small">Нет фото</div>`;
          return `<figure class="home-mini"><a href="#/feed/${esc(item.id)}">${ph}<figcaption>${esc(item.title || "Без названия")}</figcaption></a></figure>`;
        })
        .join("")
    : '<p class="muted small">В ленте пока нет карточек.</p>';

  app.innerHTML = `
    <section class="home-hero card">
      <p class="hero-kicker">AutoFinder</p>
      <h1>Подбор и продажа</h1>
      ${err ? `<p class="banner banner-err">${esc(err)}</p>` : ""}
      <div class="home-stats">
        <div class="home-stat"><strong>${stats?.publishedListings ?? "—"}</strong><span class="muted small">Опубликовано</span></div>
        <div class="home-stat"><strong>${stats?.queuePending ?? "—"}</strong><span class="muted small">В очереди публикаций</span></div>
        <div class="home-stat"><strong>${stats?.aggregated ?? "—"}</strong><span class="muted small">В ленте</span></div>
      </div>
      <div class="home-actions">
        <a class="button" href="#/listings">Каталог</a>
        <a class="button ghost" href="#/my-listings">Мои объявления</a>
        <a class="button ghost" href="#/create">Новое объявление</a>
        <a class="button ghost" href="#/favorites">Избранное</a>
        <a class="button ghost" href="#/messages">Сообщения</a>
      </div>
    </section>
    <section class="card">
      <h2>Свежие в ленте</h2>
      <div class="home-featured">${cards}</div>
    </section>
  `;
}

async function pageFeed(id) {
  await loadRate();
  const app = $("#app");
  document.title = "Лента — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  let item;
  try {
    item = await api(`/api/aggregated/${encodeURIComponent(id)}`);
  } catch {
    app.innerHTML = `<section class="hero"><h1>Не найдено</h1><p class="muted"><a href="#/home">На главную</a></p></section>`;
    return;
  }
  const raw = item.image_urls;
  const urls = (Array.isArray(raw) ? raw : []).map((u) => resolveMediaUrl(String(u))).filter(Boolean);
  const main = urls[0] || null;
  const brandModel = [item.brand, item.model].filter(Boolean).join(" ").trim() || "—";
  document.title = `${item.title || "Карточка"} — AutoFinder`;
  app.innerHTML = `
    <p class="banner muted small"><a href="#/home">← Главная</a> · <span class="ls-av__badge-inline">Рынок (агрегат)</span></p>
    <div class="ls-av" id="listing-av-card">
      <header class="ls-av__top">
        <h1 class="ls-av__title">${esc(item.title)}</h1>
        <div class="ls-av__meta-line muted small">Обновлено: ${item.fetched_at ? esc(fmtDt(item.fetched_at)) : "—"}</div>
      </header>
      <div class="ls-av__wrap">
        <div class="ls-av__gallery">
          <div class="ls-av__stage">
            ${main ? imgTag(main, item.title, "ls-av__stage-img") : `<div class="ls-av__stage-placeholder">Нет фотографий</div>`}
          </div>
        </div>
        <aside class="ls-av__side">
          <div class="ls-av__side-inner">
            <div class="ls-av__prices">
              <div class="ls-av__price-primary"><span class="ls-av__price-value">${esc(fmtByn(item.price_byn).replace(" BYN", ""))}</span><span class="ls-av__price-cur">BYN</span></div>
              <div class="ls-av__price-secondary">${fmtUsd(item.price_byn)}</div>
            </div>
            <p class="ls-av__params">${item.year ? `${item.year} г.` : "—"} · ${esc(item.city || "—")}</p>
          </div>
        </aside>
      </div>
      <div class="ls-av__panels ls-av__panels--specs">
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Параметры</h2>
          ${specsGridHtml([
            ["Марка / модель", brandModel],
            ["Год", item.year != null ? String(item.year) : "—"],
            [
              "Пробег",
              item.mileage_km != null ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км` : "—",
            ],
            ["Город", item.city || "—"],
          ])}
        </section>
      </div>
    </div>
  `;
}

function pageSettings() {
  const app = $("#app");
  document.title = "Тема оформления — AutoFinder";
  const cur = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  app.innerHTML = `
    <section class="hero"><h1>Тема сайта</h1></section>
    <section class="card narrow-profile">
      <h2>Оформление</h2>
      <div class="settings-theme-row">
        <button type="button" class="settings-theme-btn${cur === "dark" ? " is-on" : ""}" data-theme-pick="dark">Тёмная</button>
        <button type="button" class="settings-theme-btn${cur === "light" ? " is-on" : ""}" data-theme-pick="light">Светлая</button>
      </div>
      <p class="muted small"><a href="#/home">На главную</a></p>
    </section>
  `;
  $$("[data-theme-pick]", app).forEach((btn) => {
    btn.addEventListener("click", () => {
      setWebTheme(btn.getAttribute("data-theme-pick"));
      pageSettings();
    });
  });
}

function isAdminUser() {
  const u = getUser();
  return Boolean(u && u.role === "admin");
}

function staffPendingCardsInnerHtml(rows) {
  if (!rows.length) return '<p class="empty">Нет заявок на модерации.</p>';
  return rows
    .map((row) => {
      const img = firstImageUrl(row);
      return `<article class="staff-card">
            <div>${img ? imgTag(img, row.title, "profile-listing-card__img") : `<div class="placeholder">Нет фото</div>`}</div>
            <div class="staff-card__meta">
              <strong><a href="#/staff/${esc(row.id)}">${esc(row.title)}</a></strong>
              <div class="muted small">${esc(row.brand)} ${esc(row.model)} · ${esc(String(row.year || ""))}</div>
              <div class="muted small">${esc(row.owner_email || "")}</div>
            </div>
            <a class="button" href="#/staff/${esc(row.id)}">Проверить</a>
          </article>`;
    })
    .join("");
}

function adminTabHref(tab) {
  return `#/admin?tab=${encodeURIComponent(tab)}`;
}

function renderAdminTabs(activeTab) {
  const tabs = [
    { id: "moderation", label: "Модерация" },
    { id: "users", label: "Пользователи" },
    { id: "listings", label: "Объявления" },
  ];
  return `<nav class="admin-tabs" aria-label="Разделы админ-панели">${tabs
    .map(
      (t) =>
        `<a class="admin-tab${t.id === activeTab ? " is-active" : ""}" href="${adminTabHref(t.id)}">${esc(
          t.label
        )}</a>`
    )
    .join("")}</nav>`;
}

function adminListingsQueryHash(q, status, offset) {
  const p = new URLSearchParams();
  p.set("tab", "listings");
  if (q) p.set("q", q);
  if (status && status !== "all") p.set("status", status);
  if (offset > 0) p.set("offset", String(offset));
  return `#/admin?${p.toString()}`;
}

async function pageAdmin(query) {
  const app = $("#app");
  if (!getUser()) {
    location.hash = "#/login";
    return;
  }
  if (!isAdminUser()) {
    document.title = "Доступ — AutoFinder";
    app.innerHTML = `<section class="hero"><h1>Нет доступа</h1><p class="muted">Админ-панель доступна только администраторам.</p></section>`;
    return;
  }
  const tabRaw = String(query.tab || "moderation").toLowerCase();
  const tab = tabRaw === "users" || tabRaw === "listings" ? tabRaw : "moderation";
  document.title = "Админ-панель — AutoFinder";

  app.innerHTML = `
    <div class="admin-shell">
      <section class="hero admin-hero">
        <h1>Админ-панель</h1>
      </section>
      ${renderAdminTabs(tab)}
      <div class="admin-panel card" id="admin-panel-root"><p class="loading">Загрузка…</p></div>
    </div>`;

  const root = $("#admin-panel-root");
  if (!root) return;

  if (tab === "moderation") {
    let rows = [];
    try {
      rows = await api("/api/staff/pending-listings");
    } catch (e) {
      root.innerHTML = `<p class="error">${esc(e.message)}</p>`;
      return;
    }
    root.innerHTML = `<div class="staff-queue" style="margin-top:0">${staffPendingCardsInnerHtml(rows)}</div>`;
    return;
  }

  if (tab === "users") {
    const q = String(query.q || "").trim();
    root.innerHTML = `
      <form id="admin-users-search" class="admin-toolbar">
        <input type="search" name="q" value="${esc(q)}" placeholder="Поиск по email, имени, телефону…" autocomplete="off" />
        <button type="submit" class="button">Найти</button>
        <a class="button ghost" href="${adminTabHref("users")}">Сбросить</a>
      </form>
      <p class="loading">Загрузка…</p>`;
    $("#admin-users-search")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const qq = fd.get("q")?.toString().trim() || "";
      location.hash = qq ? `#/admin?tab=users&q=${encodeURIComponent(qq)}` : "#/admin?tab=users";
    });
    const loadingEl = root.querySelector(".loading");
    let rows = [];
    try {
      rows = await api(`/api/admin/users?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    } catch (e) {
      if (loadingEl) loadingEl.remove();
      root.insertAdjacentHTML("beforeend", `<p class="error">${esc(e.message)}</p>`);
      return;
    }
    if (loadingEl) loadingEl.remove();
    const roleRu = { user: "Пользователь", moderator: "Модератор", admin: "Админ" };
    const table = `<div class="admin-table-wrap"><table class="data-table admin-table"><thead><tr>
      <th>Email</th><th>Имя</th><th>Телефон</th><th>Роль</th><th>Объявл.</th><th>Статус</th><th></th>
    </tr></thead><tbody>
      ${rows
        .map((u) => {
          const blocked = Boolean(u.is_blocked);
          return `<tr data-user-id="${esc(u.id)}">
            <td>${esc(u.email)}</td>
            <td>${esc(u.full_name || "—")}</td>
            <td>${esc(u.phone || "—")}</td>
            <td>${esc(roleRu[u.role] || u.role)}</td>
            <td>${esc(String(u.listings_count ?? 0))}</td>
            <td>${blocked ? '<span class="admin-badge admin-badge--warn">Заблокирован</span>' : "Активен"}</td>
            <td class="admin-table__actions">
              <button type="button" class="linkish admin-toggle-block" data-id="${esc(u.id)}" data-blocked="${blocked ? "1" : "0"}">${blocked ? "Разблокировать" : "Заблокировать"}</button>
            </td>
          </tr>`;
        })
        .join("")}
    </tbody></table></div>
    ${rows.length ? "" : '<p class="muted small">Пользователи не найдены.</p>'}`;
    root.insertAdjacentHTML("beforeend", table);
    root.querySelectorAll(".admin-toggle-block").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const cur = btn.getAttribute("data-blocked") === "1";
        if (!id) return;
        const next = !cur;
        if (!confirm(next ? "Заблокировать пользователя?" : "Разблокировать пользователя?")) return;
        try {
          await api(`/api/admin/users/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ is_blocked: next }),
          });
          const qs = new URLSearchParams(location.hash.replace(/^#/, "").split("?")[1] || "");
          await pageAdmin({ tab: "users", q: qs.get("q") || "" });
        } catch (err) {
          alert(err.message || "Ошибка");
        }
      });
    });
    return;
  }

  const q = String(query.q || "").trim();
  const statusRaw = String(query.status || "all").toLowerCase();
  const status = ["all", "draft", "published", "moderation", "archived"].includes(statusRaw) ? statusRaw : "all";
  const offset = Math.max(0, Number(query.offset) || 0);
  const limit = 40;

  root.innerHTML = `
    <form id="admin-listings-search" class="admin-toolbar admin-toolbar--wrap">
      <input type="search" name="q" value="${esc(q)}" placeholder="ID, заголовок, марка, email владельца…" autocomplete="off" />
      <label class="admin-select-label muted small">Статус
        <select name="status">
          <option value="all"${status === "all" ? " selected" : ""}>Все</option>
          <option value="draft"${status === "draft" ? " selected" : ""}>Черновик</option>
          <option value="published"${status === "published" ? " selected" : ""}>Опубликовано</option>
          <option value="moderation"${status === "moderation" ? " selected" : ""}>На модерации</option>
          <option value="archived"${status === "archived" ? " selected" : ""}>Архив</option>
        </select>
      </label>
      <button type="submit" class="button">Найти</button>
      <a class="button ghost" href="${adminTabHref("listings")}">Сбросить</a>
    </form>
    <p class="loading">Загрузка…</p>`;

  $("#admin-listings-search")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const qq = fd.get("q")?.toString().trim() || "";
    const st = fd.get("status")?.toString() || "all";
    const p = new URLSearchParams();
    p.set("tab", "listings");
    if (qq) p.set("q", qq);
    if (st && st !== "all") p.set("status", st);
    location.hash = `#/admin?${p.toString()}`;
  });

  const loadingEl = root.querySelector(".loading");
  let data;
  try {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset), status });
    if (q) qs.set("q", q);
    data = await api(`/api/admin/listings?${qs.toString()}`);
  } catch (e) {
    if (loadingEl) loadingEl.remove();
    root.insertAdjacentHTML("beforeend", `<p class="error">${esc(e.message)}</p>`);
    return;
  }
  if (loadingEl) loadingEl.remove();
  const items = data.items || [];
  const total = Number(data.total) || 0;
  const nextOffset = offset + items.length;

  const pagerHtml =
    offset > 0 || nextOffset < total
      ? `<div class="admin-pager">
          ${offset > 0 ? `<a class="button ghost" href="${esc(adminListingsQueryHash(q, status, Math.max(0, offset - limit)))}">← Назад</a>` : ""}
          <span class="muted small">Показано ${offset + (items.length ? 1 : 0)}–${offset + items.length} из ${total}</span>
          ${nextOffset < total ? `<a class="button ghost" href="${esc(adminListingsQueryHash(q, status, nextOffset))}">Далее →</a>` : ""}
        </div>`
      : total > 0
        ? `<p class="muted small">Всего записей: ${total}</p>`
        : "";

  const table = `<div class="admin-table-wrap"><table class="data-table admin-table admin-table--listings"><thead><tr>
      <th></th><th>Объявление</th><th>Владелец</th><th>Статус</th><th>Цена</th><th>Создано</th><th></th>
    </tr></thead><tbody>
      ${items
        .map((row) => {
          const img = firstImageUrl(row);
          const stLabel = STATUS[row.status] || row.status || "—";
          return `<tr>
            <td class="admin-thumb-cell">${img ? imgTag(img, row.title, "admin-thumb") : '<span class="muted small">—</span>'}</td>
            <td><strong>${esc(row.title || `${row.brand} ${row.model}`)}</strong><div class="muted small">${esc(row.brand)} ${esc(row.model)} · ${esc(String(row.year || "—"))}</div></td>
            <td class="muted small">${esc(row.owner_email || "—")}</td>
            <td>${esc(stLabel)}</td>
            <td>${esc(fmtByn(row.price_byn))}</td>
            <td class="muted small">${esc(fmtDt(row.created_at))}</td>
            <td><a class="button ghost" href="#/listings/${esc(row.id)}">На сайте</a></td>
          </tr>`;
        })
        .join("")}
    </tbody></table></div>`;

  root.insertAdjacentHTML(
    "beforeend",
    `${items.length ? table : '<p class="muted small">Ничего не найдено.</p>'}${pagerHtml}`
  );
}

function isStaffUser() {
  const u = getUser();
  return u && (u.role === "moderator" || u.role === "admin");
}

async function pageStaff() {
  const app = $("#app");
  if (!getUser()) {
    location.hash = "#/login";
    return;
  }
  if (!isStaffUser()) {
    document.title = "Доступ — AutoFinder";
    app.innerHTML = `<section class="hero"><h1>Нет доступа</h1><p class="muted">Модерация доступна модераторам и администраторам.</p></section>`;
    return;
  }
  document.title = "Модерация — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  let rows = [];
  try {
    rows = await api("/api/staff/pending-listings");
  } catch (e) {
    app.innerHTML = `<section class="hero"><h1>Ошибка</h1><p class="error">${esc(e.message)}</p><p><a href="#/home">Главная</a></p></section>`;
    return;
  }
  const list = staffPendingCardsInnerHtml(rows);
  app.innerHTML = `
    <section class="hero"><h1>Модерация</h1></section>
    <div class="staff-queue">${list}</div>
  `;
}

async function pageStaffReview(id) {
  const app = $("#app");
  if (!getUser()) {
    location.hash = "#/login";
    return;
  }
  if (!isStaffUser()) {
    location.hash = "#/staff";
    return;
  }
  document.title = "Проверка заявки — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  await loadEquipmentCatalog(api);
  let item;
  try {
    item = await api(`/api/staff/pending-listings/${encodeURIComponent(id)}`);
  } catch {
    app.innerHTML = `<section class="hero"><h1>Заявка не найдена</h1><p class="muted"><a href="#/staff">К списку</a></p></section>`;
    return;
  }
  const eqSections = parseListingEquipment(item);
  const equipmentHtml = equipmentDisplayHtml(eqSections, esc);
  const specRows = listingSpecRows(item);
  const imgs = parseImagesField(item.images)
    .map((p) => resolveMediaUrl(p))
    .filter(Boolean);
  const mainSrc = imgs[0] || null;
  app.innerHTML = `
    <p class="muted small"><a href="#/staff">← Все заявки</a></p>
    <div class="banner banner-warn">Одобрить или отклонить с причиной.</div>
    <div class="ls-av">
      <header class="ls-av__top">
        <h1 class="ls-av__title">${esc(item.title)}</h1>
        <p class="muted small">Автор: ${esc(item.owner_email || "")} ${item.owner_name ? `· ${esc(item.owner_name)}` : ""}</p>
      </header>
      <div class="ls-av__wrap">
        <div class="ls-av__gallery">
          <div class="ls-av__stage">
            ${mainSrc ? imgTag(mainSrc, item.title, "ls-av__stage-img") : `<div class="ls-av__stage-placeholder">Нет фото</div>`}
          </div>
        </div>
        <aside class="ls-av__side">
          <div class="ls-av__side-inner">
            <div class="ls-av__prices"><div class="ls-av__price-primary"><span class="ls-av__price-value">${esc(fmtByn(item.price_byn).replace(" BYN", ""))}</span><span class="ls-av__price-cur">BYN</span></div></div>
          </div>
        </aside>
      </div>
      ${equipmentHtml}
      <div class="ls-av__panels ls-av__panels--specs">
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Характеристики</h2>
          ${specsGridHtml(specRows)}
        </section>
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Описание</h2>
          <div class="ls-av__description">${esc(item.description || "—").replace(/\n/g, "<br />")}</div>
        </section>
      </div>
      <div class="card stack" style="margin-top:1rem">
        <button type="button" class="button" id="staff-approve" data-id="${esc(item.id)}">Одобрить</button>
        <form id="staff-reject-form" class="stack" data-id="${esc(item.id)}">
          <label>Причина отклонения<textarea name="reason" rows="2" maxlength="500" placeholder="Необязательно, но лучше указать"></textarea></label>
          <button type="submit" class="button ghost danger-outline">Отклонить</button>
        </form>
      </div>
    </div>
  `;
  initEquipmentToggle(app);
  $("#staff-approve")?.addEventListener("click", async () => {
    if (!confirm("Одобрить и опубликовать объявление?")) return;
    try {
      await api(`/api/staff/pending-listings/${encodeURIComponent(id)}/approve`, { method: "POST", body: "{}" });
      location.hash = "#/staff";
    } catch (e) {
      alert(e.message || "Ошибка");
    }
  });
  $("#staff-reject-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!confirm("Отклонить заявку?")) return;
    const fd = new FormData(e.target);
    const reason = fd.get("reason")?.toString().trim() || null;
    try {
      await api(`/api/staff/pending-listings/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      location.hash = "#/staff";
    } catch (err) {
      alert(err.message || "Ошибка");
    }
  });
}

async function pageCompare() {
  await loadRate();
  const app = $("#app");
  document.title = "Сравнение — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const valid = await saved.loadCompareList();
  if (!valid.length) {
    app.innerHTML = `
      <section class="hero hero-catalog card"><div class="hero-catalog__main"><p class="hero-kicker">Сравнение</p><h1>Сравнение автомобилей</h1></div></section>
      <p class="empty">Пока нечего сравнивать. Добавьте объявления из каталога.</p>`;
    return;
  }
  const rows = [
    ["Цена", (i) => fmtByn(i.price_byn)],
    ["Год", (i) => String(i.year || "—")],
    ["Пробег", (i) => (i.mileage_km != null ? `${i.mileage_km} км` : "—")],
    ["Топливо", (i) => label(FUEL, i.fuel_type)],
    ["Коробка", (i) => label(TRANS, i.transmission)],
    ["Кузов", (i) => label(BODY, i.body_type)],
    ["Привод", (i) => i.drivetrain || "—"],
    ["Объём", (i) => (i.engine_volume_ml ? fmtEngineMl(i.engine_volume_ml) : "—")],
    ["Цвет", (i) => i.color || "—"],
    ["Город", (i) => i.city || "—"],
  ];
  app.innerHTML = `
    <section class="hero hero-catalog card">
      <div class="hero-catalog__main"><p class="hero-kicker">Сравнение</p><h1>Сравнение автомобилей</h1></div>
      <div class="hero-catalog__stats">
        <div class="hero-stat"><span class="hero-stat__label">Добавлено</span><strong class="hero-stat__value">${valid.length}</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">Лимит</span><strong class="hero-stat__value">${CMP_MAX}</strong></div>
      </div>
    </section>
    <div class="compare-grid">${valid
      .map((item) => {
        const img = firstImageUrl(item);
        return `<section class="card compare-card">
          <div class="compare-card__media">${img ? imgTag(img, "", "compare-card__img") : `<div class="placeholder">Нет фото</div>`}</div>
          <h2 class="compare-card__title"><a href="#/listings/${esc(item.id)}">${esc(item.brand)} ${esc(item.model)}</a></h2>
          <p class="compare-card__price">${fmtByn(item.price_byn)}</p>
          <div class="compare-card__actions">
            <a class="button ghost" href="#/listings/${esc(item.id)}">Открыть</a>
            <button type="button" class="button ghost danger-outline" data-cmp-remove="${esc(item.id)}">Убрать</button>
          </div>
        </section>`;
      })
      .join("")}</div>
    <div class="card compare-table-wrap"><table class="data-table compare-table"><tbody>
      ${rows
        .map(
          ([lab, fn]) =>
            `<tr><th>${esc(lab)}</th>${valid.map((i) => `<td>${esc(fn(i))}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody></table></div>
  `;
  $$("[data-cmp-remove]", app).forEach((btn) => {
    btn.addEventListener("click", () => {
      void saved
        .toggleCompare(btn.getAttribute("data-cmp-remove"))
        .then(() => {
          renderNav();
          return pageCompare();
        })
        .catch((err) => {
          if (err?.message === "limit") alert(`В сравнении не больше ${CMP_MAX} объявлений.`);
        });
    });
  });
}

async function pageMessages(query) {
  const user = getUser();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  const app = $("#app");
  document.title = "Сообщения — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const threads = await api("/api/conversations");
  const convId = query.conv;
  let messages = [];
  let active = null;
  if (convId) {
    active = threads.find((t) => String(t.id) === String(convId));
    messages = await api(`/api/conversations/${convId}/messages`);
  }
  app.innerHTML = `
    <section class="hero"><h1>Сообщения</h1></section>
    <div class="messages-layout" id="messages-root">
      <aside class="card messages-sidebar">
        <div class="messages-thread-list">
          ${threads.length ? threads.map((t) => `<a class="messages-thread${String(t.id) === String(convId) ? " is-active" : ""}" href="#/messages?conv=${esc(t.id)}"><div class="messages-thread__top"><strong>${esc(t.peer_name || t.peer_email)}</strong><span class="muted small">${fmtDt(t.last_message_at || t.updated_at)}</span></div><div class="muted small">${esc(t.listing_brand)} ${esc(t.listing_model)}</div><div>${esc((t.last_message || "").slice(0, 80))}</div></a>`).join("") : '<p class="muted small">Пока нет сообщений</p>'}
        </div>
      </aside>
      <section class="card messages-main">
        ${
          active
            ? `<div class="messages-head"><h2>${esc(active.peer_name || active.peer_email)}</h2><p class="muted small">Объявление: <a href="#/listings/${esc(active.listing_id)}">${esc(active.listing_title || active.listing_brand)}</a></p></div>
          <div class="messages-log" id="messages-log">${messages.map((m) => `<article class="message-item${m.sender_id === user.id ? " is-own" : ""}"><div class="message-bubble">${m.sender_id !== user.id ? `<div class="message-bubble__name muted small">${esc(m.sender_name || "")}</div>` : ""}<div class="message-bubble__text">${esc(m.body)}</div><div class="message-bubble__time muted small">${fmtDt(m.created_at)}</div></div></article>`).join("")}</div>
          <form class="messages-reply" id="messages-reply-form" data-conv="${esc(active.id)}"><textarea name="body" rows="3" required maxlength="2000" placeholder="Сообщение…"></textarea><button type="submit">Отправить</button></form>`
            : `<p class="muted">Выберите диалог слева.</p>`
        }
      </section>
    </div>
  `;
  const log = $("#messages-log");
  if (log) log.scrollTop = log.scrollHeight;
  $("#messages-reply-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = fd.get("body")?.toString().trim();
    const cid = e.target.getAttribute("data-conv");
    if (!body || !cid) return;
    await api(`/api/conversations/${cid}/messages`, { method: "POST", body: JSON.stringify({ body }) });
    location.hash = `#/messages?conv=${cid}`;
  });
}

async function pageProfile() {
  const user = getUser();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  document.title = "Профиль — AutoFinder";
  let me = user;
  try {
    me = await api("/api/auth/me");
    setUser(me, localStorage.getItem(TOKEN_KEY));
  } catch {
    /* keep cached */
  }
  $("#app").innerHTML = `
    <section class="hero"><h1>Профиль</h1><p class="muted">${esc(me.email)}</p></section>
    <div class="profile-shortcuts">
      <a class="card profile-shortcut" href="#/my-listings"><strong>Мои объявления</strong></a>
      <a class="card profile-shortcut" href="#/favorites"><strong>Избранное</strong></a>
      <a class="card profile-shortcut" href="#/compare"><strong>Сравнение</strong></a>
      <a class="card profile-shortcut" href="#/messages"><strong>Сообщения</strong></a>
      <a class="card profile-shortcut" href="#/settings"><strong>Тема сайта</strong></a>
      ${
        me.role === "admin"
          ? `<a class="card profile-shortcut" href="#/admin"><strong>Админ-панель</strong></a>`
          : me.role === "moderator"
            ? `<a class="card profile-shortcut" href="#/staff"><strong>Модерация</strong></a>`
            : ""
      }
    </div>
    <section class="card narrow-profile profile-form">
      <h2>Данные аккаунта</h2>
      <form id="profile-form" class="stack">
        <label>Имя<input type="text" name="full_name" maxlength="120" value="${esc(me.full_name || "")}" /></label>
        <label>Телефон<input type="text" name="phone" maxlength="32" value="${esc(me.phone || "")}" placeholder="+375…" /></label>
        <label>Госномер<input type="text" name="plate_number" maxlength="16" value="${esc(me.plate_number || "")}" /></label>
        <p class="muted small">Роль: ${esc(me.role)} · ${esc(me.email)}</p>
        <button type="submit">Сохранить</button>
      </form>
      <p id="profile-msg" class="success-msg hidden"></p>
    </section>
  `;
  $("#profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const updated = await api("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fd.get("full_name")?.toString().trim() || null,
          phone: fd.get("phone")?.toString().trim() || null,
          plate_number: fd.get("plate_number")?.toString().trim() || null,
        }),
      });
      setUser(updated, localStorage.getItem(TOKEN_KEY));
      const msg = $("#profile-msg");
      msg.textContent = "Сохранено";
      msg.classList.remove("hidden");
    } catch (err) {
      alert(err.message);
    }
  });
}

async function pageFavorites() {
  await loadRate();
  const app = $("#app");
  document.title = "Избранное — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const items = await saved.loadFavoritesList();
  app.innerHTML = `<section class="hero"><h1>Избранное</h1></section>${items.length ? `<div class="catalog-grid">${items.map((i) => catalogCard(i)).join("")}</div>` : '<p class="empty">Список пуст.</p>'}`;
  bindCardActions(app);
}

async function pageMyListings() {
  const user = getUser();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  await loadRate();
  const app = $("#app");
  document.title = "Мои объявления — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const rows = await api("/api/me/listings");
  app.innerHTML = `
    <section class="hero"><h1>Мои объявления</h1></section>
    <div class="profile-listings">
      ${rows.length ? rows.map((item) => {
        const img = firstImageUrl(item);
        return `<article class="card profile-listing-card">
          <div class="profile-listing-card__media">${img ? imgTag(img, "", "profile-listing-card__img") : `<div class="placeholder">Нет фото</div>`}</div>
          <div class="profile-listing-card__body">
            <div class="profile-listing-card__head"><div><h2><a href="#/listings/${esc(item.id)}">${esc(item.title || `${item.brand} ${item.model}`)}</a></h2><p class="muted small">${esc(STATUS[item.status] || item.status)}</p></div><div class="profile-listing-card__price">${fmtByn(item.price_byn)}</div></div>
            <div class="profile-listing-card__actions">
              <a class="button ghost" href="#/listings/${esc(item.id)}">Открыть</a>
              <a class="button ghost" href="#/create?edit=${esc(item.id)}">Изменить</a>
              <button type="button" class="button ghost danger-outline" data-delete-listing="${esc(item.id)}">Удалить</button>
            </div>
          </div>
        </article>`;
      }).join("") : '<p class="empty">У вас пока нет объявлений.</p>'}
    </div>
  `;
  app.querySelectorAll("[data-delete-listing]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-listing");
      if (!id || !confirm("Удалить объявление?")) return;
      try {
        await api(`/api/listings/${encodeURIComponent(id)}`, { method: "DELETE" });
        await pageMyListings();
      } catch (err) {
        alert(err.message || "Не удалось удалить");
      }
    });
  });
}

async function router() {
  const route = parseRoute();
  if (location.hash === "#/" || location.hash === "#") {
    location.replace("#/home");
    return;
  }
  try {
    switch (route.page) {
      case "listings":
        await pageListings(route.query);
        break;
      case "listing":
        await pageListing(route.id);
        break;
      case "login":
        await pageLogin();
        break;
      case "register":
        await pageRegister();
        break;
      case "help":
        pageHelp();
        break;
      case "home":
        await pageHome();
        break;
      case "feed":
        await pageFeed(route.id);
        break;
      case "admin":
        await pageAdmin(route.query);
        break;
      case "settings":
        pageSettings();
        break;
      case "staff":
        await pageStaff();
        break;
      case "staff-review":
        await pageStaffReview(route.id);
        break;
      case "compare":
        await pageCompare();
        break;
      case "messages":
        await pageMessages(route.query);
        break;
      case "profile":
        await pageProfile();
        break;
      case "favorites":
        await pageFavorites();
        break;
      case "my-listings":
        await pageMyListings();
        break;
      case "create-listing":
        await pageCreateListing(route.query.edit);
        break;
      default:
        await pageHome();
    }
  } catch (e) {
    $("#app").innerHTML = `<p class="error">Ошибка: ${esc(e.message)}</p>`;
  }
}

async function boot() {
  await saved.refresh();
  renderNav();
  window.addEventListener("hashchange", router);
  if (!location.hash || location.hash === "#") location.hash = "#/home";
  else await router();
}

void boot();
