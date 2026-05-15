import {
  BODY,
  FUEL,
  STATUS,
  TRANS,
  FILTER_BODY,
  FILTER_DRIVE,
  FILTER_FUEL,
  FILTER_TRANS,
  label,
} from "./labels.js";
import { CMP_MAX, createSavedStore } from "./saved.js";
import {
  attrEsc,
  firstImageUrl,
  imgTag,
  parseImagesField,
  resolveMediaUrl,
} from "./media.js";

const TOKEN_KEY = "af_token";
const USER_KEY = "af_user";
const PAGE_SIZE = 20;

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
  const hash = location.hash.replace(/^#/, "") || "/listings";
  const [path, qs] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
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
  return { page: "listings", query };
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
    <a href="${navHref("/listings")}">Каталог</a>
    <a href="${navHref("/compare")}">Сравнение${cmp ? ` (${cmp})` : ""}</a>
    <a href="${navHref("/help")}">Справка</a>
  `;
  if (user) {
    html += `
      <a href="${navHref("/profile")}">Профиль</a>
      <a href="${navHref("/my-listings")}">Мои объявления</a>
      <a href="${navHref("/favorites")}">Избранное</a>
      <a href="${navHref("/messages")}">Сообщения</a>
      <a href="${navHref("/help")}" class="nav-cta">Разместить</a>
    `;
    if (user.role === "moderator" || user.role === "admin") {
      html += `<a href="${navHref("/help")}" title="Модерация в мобильном приложении">Модерация</a>`;
    }
    if (user.role === "admin") {
      html += `<a href="${navHref("/help")}" title="Админка в мобильном приложении">Админ</a>`;
    }
    html += `<button type="button" class="linkish" id="btn-logout">Выйти (${esc(user.full_name || user.email)})</button>`;
  } else {
    html += `
      <a href="${navHref("/login")}">Вход</a>
      <a href="${navHref("/register")}">Регистрация</a>
    `;
  }
  nav.innerHTML = html;
  const lo = $("#btn-logout");
  if (lo) {
    lo.addEventListener("click", () => {
      setUser(null, null);
      location.hash = "#/listings";
    });
  }
}

function catalogCard(item, opts = {}) {
  const img = firstImageUrl(item);
  const isFav = saved?.isFavorite(item.id);
  const isCmp = saved?.isCompared(item.id);
  const user = getUser();
  const pBits = [
    item.year ? `${item.year} г.` : null,
    label(BODY, item.body_type),
    label(TRANS, item.transmission),
    label(FUEL, item.fuel_type),
  ].filter(Boolean);
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
            ${title ? `<p class="catalog-card__excerpt">${esc(title.slice(0, 90))}</p>` : ""}
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
  const fuelOpts = optList(FILTER_FUEL, query.fuel);
  const bodyOpts = optList(FILTER_BODY, query.body);
  const transOpts = optList(FILTER_TRANS, query.transmission);
  const driveOpts = optList(FILTER_DRIVE, query.drivetrain);
  const brandOpts = brands
    .map((b) => `<option value="${esc(b.name)}" ${query.brand === b.name ? "selected" : ""}>${esc(b.name)}</option>`)
    .join("");

  app.innerHTML = `
    <section class="hero hero-catalog card">
      <div class="hero-catalog__main">
        <p class="hero-kicker">AutoFinder</p>
        <h1>Каталог автомобилей и мототехники</h1>
        <p class="muted">Подбор по цене, пробегу, кузову и городу. Сохраняйте интересные варианты в избранное и отслеживайте популярные объявления.</p>
      </div>
      <div class="hero-catalog__stats">
        <div class="hero-stat"><span class="hero-stat__label">Найдено</span><strong class="hero-stat__value">${total}</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">Марок</span><strong class="hero-stat__value">${brands.length}</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">С фото в выдаче</span><strong class="hero-stat__value">${withPhotos}</strong></div>
      </div>
    </section>

    <form class="filters card" id="search-form">
      <div class="filters-grid">
        <label><span>Текст</span><input type="search" name="q" value="${esc(query.q || "")}" placeholder="Например: Toyota седан" /></label>
        <label><span>Марка</span><select name="brand" id="filter-brand"><option value="">—</option>${brandOpts}</select></label>
        <label><span>Модель</span><input type="text" name="model" id="filter-model" value="${esc(query.model || "")}" placeholder="Модель" /></label>
        <label><span>Цена от</span><input type="number" name="price_min" min="0" step="1000" value="${esc(query.price_min || "")}" /></label>
        <label><span>Цена до</span><input type="number" name="price_max" min="0" step="1000" value="${esc(query.price_max || "")}" /></label>
        <label><span>Год от</span><input type="number" name="year_min" min="1950" max="2100" value="${esc(query.year_min || "")}" /></label>
        <label><span>Год до</span><input type="number" name="year_max" min="1950" max="2100" value="${esc(query.year_max || "")}" /></label>
        <label><span>Топливо</span><select name="fuel"><option value="">—</option>${fuelOpts}</select></label>
        <label><span>Кузов</span><select name="body"><option value="">—</option>${bodyOpts}</select></label>
        <label><span>Коробка</span><select name="transmission"><option value="">—</option>${transOpts}</select></label>
        <label><span>Привод</span><select name="drivetrain"><option value="">—</option>${driveOpts}</select></label>
        <label><span>Поколение</span><input type="text" name="generation" value="${esc(query.generation || "")}" placeholder="рестайлинг" /></label>
        <label><span>Объём от, л</span><input type="number" name="volume_from" min="0" step="0.1" value="${esc(query.volume_from || "")}" /></label>
        <label><span>Объём до, л</span><input type="number" name="volume_to" min="0" step="0.1" value="${esc(query.volume_to || "")}" /></label>
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

    <p class="results-meta">Найдено: <strong>${total}</strong>${query.has_photo ? " · только объявления с фотографиями" : ""}</p>
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

function initListingDetail(root) {
  const av = root.querySelector("#listing-av-card");
  if (!av) return;
  const stageImg = av.querySelector(".ls-av__stage-img");
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
  const user = getUser();
  const imgs = parseImagesField(item.images)
    .map((p) => resolveMediaUrl(p))
    .filter(Boolean);
  const mainSrc = imgs[0] || null;
  const paramLine = [
    item.year ? `${item.year} г.` : null,
    label(BODY, item.body_type),
    label(TRANS, item.transmission),
    label(FUEL, item.fuel_type),
  ]
    .filter(Boolean)
    .join(", ");
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

  app.innerHTML = `
    ${item.status === "moderation" ? '<p class="banner banner-warn">Объявление на модерации — в каталоге появится после проверки.</p>' : ""}
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
            <p class="ls-av__params">${esc(paramLine)}, <strong>${item.mileage_km != null ? `${Number(item.mileage_km).toLocaleString("ru-BY")} км` : "—"}</strong></p>
            <p class="ls-av__sub">${esc(item.year)} г., ${esc(label(TRANS, item.transmission))}, ${esc(label(FUEL, item.fuel_type))}</p>
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
      <div class="ls-av__panels">
        <section class="ls-av__panel">
          <h2 class="ls-av__panel-title">Параметры</h2>
          <dl class="ls-av__specs">
            <div><dt>Топливо</dt><dd>${esc(label(FUEL, item.fuel_type))}</dd></div>
            <div><dt>Коробка</dt><dd>${esc(label(TRANS, item.transmission))}</dd></div>
            <div><dt>Кузов</dt><dd>${esc(label(BODY, item.body_type))}</dd></div>
            ${item.drivetrain ? `<div><dt>Привод</dt><dd>${esc(item.drivetrain)}</dd></div>` : ""}
            <div><dt>Город</dt><dd>${esc(item.city)}</dd></div>
          </dl>
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
            <p class="muted small">Оценка ориентировочная: итоговые условия зависят от банка.</p>
          </div>
        </section>
        <section class="ls-av__panel ls-av__panel--wide">
          <h2 class="ls-av__panel-title">Почему стоит сравнить</h2>
          <div class="compare-hint">
            <p>Добавляйте до ${CMP_MAX} объявлений в сравнение, чтобы быстро сопоставить цену, пробег, кузов, коробку, топливо и город.</p>
            <a class="button ghost" href="#/compare">Открыть сравнение</a>
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
      location.hash = "#/listings";
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
      location.hash = "#/listings";
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
        <p class="muted">Ниже собраны самые частые вопросы: как найти машину, как разместить объявление и что делать, если что-то пошло не так.</p>
      </div>
      <div class="hero-catalog__stats">
        <div class="hero-stat"><span class="hero-stat__label">Для покупки</span><strong class="hero-stat__value">Каталог</strong></div>
        <div class="hero-stat"><span class="hero-stat__label">Для продажи</span><strong class="hero-stat__value">Профиль</strong></div>
      </div>
    </section>
    <section class="card help-section"><h2>1. Как найти подходящий автомобиль</h2><ol><li>Откройте <a href="#/listings">каталог</a>.</li><li>Задайте марку, модель, цену, год, тип кузова и другие фильтры.</li><li>Включите фильтр «Только с фото».</li><li>Откройте карточку объявления для описания, фотографий и контактов.</li></ol></section>
    <section class="card help-section"><h2>2. Как связаться с продавцом</h2><ul><li>Если продавец разрешил показ телефона — кнопка «Позвонить продавцу».</li><li>Напишите через форму сообщения на странице объявления (нужен вход).</li><li>Все переписки — в разделе «Сообщения».</li></ul></section>
    <section class="card help-section"><h2>3. Как разместить объявление</h2><ol><li>Зарегистрируйтесь или войдите.</li><li>Размещение объявлений — в мобильном приложении AutoFinder.</li><li>После сохранения объявление может перейти на модерацию.</li></ol></section>
    <section class="card help-section"><h2>4. Избранное и сравнение</h2><ul><li>После входа избранное и сравнение (до ${CMP_MAX} авто) синхронизируются с мобильным приложением.</li><li>Без входа данные хранятся только в этом браузере.</li><li>Калькулятор платежа на странице объявления — ориентировочный.</li></ul></section>
  `;
}

async function pageCompare() {
  await loadRate();
  const app = $("#app");
  document.title = "Сравнение — AutoFinder";
  app.innerHTML = `<p class="loading">Загрузка…</p>`;
  const valid = await saved.loadCompareList();
  if (!valid.length) {
    app.innerHTML = `
      <section class="hero hero-catalog card"><div class="hero-catalog__main"><p class="hero-kicker">Сравнение</p><h1>Сравнение автомобилей</h1><p class="muted">Сопоставляйте до ${CMP_MAX} объявлений.</p></div></section>
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
      <a class="card profile-shortcut" href="#/my-listings"><strong>Мои объявления</strong><span class="muted small">Статусы и редактирование</span></a>
      <a class="card profile-shortcut" href="#/favorites"><strong>Избранное</strong><span class="muted small">Сохранённые объявления</span></a>
      <a class="card profile-shortcut" href="#/messages"><strong>Сообщения</strong><span class="muted small">Переписка с покупателями</span></a>
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
  app.innerHTML = `<section class="hero"><h1>Избранное</h1><p class="muted small">${getUser() ? "Синхронизируется с приложением" : "Войдите, чтобы сохранить на всех устройствах"}</p></section>${items.length ? `<div class="catalog-grid">${items.map((i) => catalogCard(i)).join("")}</div>` : '<p class="empty">Список пуст.</p>'}`;
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
            <div class="profile-listing-card__actions"><a class="button ghost" href="#/listings/${esc(item.id)}">Открыть</a></div>
          </div>
        </article>`;
      }).join("") : '<p class="empty">У вас пока нет объявлений.</p>'}
    </div>
  `;
}

async function router() {
  const route = parseRoute();
  if (location.hash === "#/" || location.hash === "#") {
    location.replace("#/listings");
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
      default:
        await pageListings(route.query);
    }
  } catch (e) {
    $("#app").innerHTML = `<p class="error">Ошибка: ${esc(e.message)}</p>`;
  }
}

async function boot() {
  await saved.refresh();
  renderNav();
  window.addEventListener("hashchange", router);
  if (!location.hash || location.hash === "#") location.hash = "#/listings";
  else await router();
}

void boot();
