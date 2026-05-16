/** Каталог комплектации и UI выбора/отображения. */

let catalogCache = null;

export async function loadEquipmentCatalog(api) {
  if (catalogCache) return catalogCache;
  catalogCache = await api("/api/catalog/equipment-options");
  return catalogCache;
}

export function getCachedEquipmentCatalog() {
  return catalogCache;
}

export function parseListingEquipment(item) {
  if (item.equipment_sections?.length) {
    return item.equipment_sections;
  }
  const sections = [];
  if (item.trim_level) {
    sections.push({ id: "trim", label: "Комплектация", values: [item.trim_level] });
  }
  const map =
    item.equipment && typeof item.equipment === "object" && !Array.isArray(item.equipment)
      ? item.equipment
      : {};
  const catalog = catalogCache;
  if (catalog?.categories) {
    for (const cat of catalog.categories) {
      const vals = map[cat.id];
      if (Array.isArray(vals) && vals.length) {
        sections.push({ id: cat.id, label: cat.label, values: vals });
      }
    }
  }
  if (!sections.length && item.interior) {
    sections.push({
      id: "interior",
      label: "Салон",
      values: String(item.interior)
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  if (!sections.length && item.safety_systems) {
    sections.push({
      id: "safety",
      label: "Системы безопасности",
      values: String(item.safety_systems)
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  if (!sections.length && item.interior_details) {
    sections.push({
      id: "misc",
      label: "Опции",
      values: String(item.interior_details)
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return sections;
}

export function equipmentDisplayHtml(sections, esc, opts = {}) {
  const { collapsible = true, id = "listing-equipment" } = opts;
  if (!sections.length) return "";
  const body = sections
    .map(
      (sec) => `
      <div class="ls-av__equipment-section" data-eq-section="${sec.id}">
        <h3>${esc(sec.label)}</h3>
        <div class="ls-av__chips">${sec.values
          .map((v) => `<span class="ls-av__chip">${esc(v)}</span>`)
          .join("")}</div>
      </div>`
    )
    .join("");
  const toggle = collapsible
    ? `<button type="button" class="ls-av__equipment-toggle linkish" data-eq-toggle aria-expanded="true">Скрыть опции</button>`
    : "";
  return `
    <section class="ls-av__equipment" id="${id}">
      <h2 class="ls-av__panel-title">Комплектация</h2>
      <div class="ls-av__equipment-grid" data-eq-body>${body}</div>
      ${toggle}
    </section>`;
}

export function initEquipmentToggle(root) {
  if (!root) return;
  root.querySelectorAll("[data-eq-toggle]").forEach((btn) => {
    const block = btn.closest(".ls-av__equipment");
    const body = block?.querySelector("[data-eq-body]");
    if (!body) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const hidden = body.hidden;
      body.hidden = !hidden;
      btn.setAttribute("aria-expanded", hidden ? "true" : "false");
      btn.textContent = hidden ? "Скрыть опции" : "Показать опции";
    });
  });
}

function selectedSet(container, catId) {
  const hidden = container.querySelector(`input[data-eq-value="${catId}"]`);
  if (!hidden?.value) return new Set();
  try {
    return new Set(JSON.parse(hidden.value));
  } catch {
    return new Set();
  }
}

function writeSelection(container, catId, set) {
  const hidden = container.querySelector(`input[data-eq-value="${catId}"]`);
  if (hidden) hidden.value = JSON.stringify([...set]);
  const count = container.querySelector(`[data-eq-count="${catId}"]`);
  if (count) count.textContent = set.size ? String(set.size) : "";
}

export function renderEquipmentPickers(container, catalog, esc, initial = {}) {
  const trimVal = initial.trim_level || "";
  let html = `
    <div class="eq-field eq-field--trim">
      <label class="eq-field__label">Комплектация</label>
      <select name="trim_level" class="eq-field__select">
        <option value="">— не указано —</option>
        ${catalog.trim_levels
          .map(
            (t) =>
              `<option value="${esc(t)}"${trimVal === t ? " selected" : ""}>${esc(t)}</option>`
          )
          .join("")}
      </select>
    </div>`;

  for (const cat of catalog.categories) {
    const selected = new Set(
      Array.isArray(initial.equipment?.[cat.id])
        ? initial.equipment[cat.id]
        : []
    );
    const chips = cat.options
      .map((opt) => {
        const on = selected.has(opt);
        return `<button type="button" class="eq-chip${on ? " is-on" : ""}" data-eq-cat="${cat.id}" data-eq-opt="${esc(opt)}" aria-pressed="${on}">${esc(opt)}</button>`;
      })
      .join("");
    html += `
      <div class="eq-field" data-eq-field="${cat.id}">
        <button type="button" class="eq-field__toggle" data-eq-open="${cat.id}" aria-expanded="false">
          <span>${esc(cat.label)}</span>
          <span class="eq-field__count" data-eq-count="${cat.id}">${selected.size || ""}</span>
        </button>
        <div class="eq-field__panel" id="eq-panel-${cat.id}" hidden>
          <p class="muted small eq-field__hint">Нажмите, чтобы выбрать${cat.multiple ? " (можно несколько)" : ""}</p>
          <div class="eq-chips">${chips}</div>
        </div>
        <input type="hidden" data-eq-value="${cat.id}" value='${esc(JSON.stringify([...selected]))}' />
      </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll("[data-eq-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-eq-open");
      const panel = container.querySelector(`#eq-panel-${id}`);
      if (!panel) return;
      const open = panel.hidden;
      container.querySelectorAll(".eq-field__panel").forEach((p) => {
        p.hidden = true;
      });
      container.querySelectorAll("[data-eq-open]").forEach((b) => {
        b.setAttribute("aria-expanded", "false");
      });
      if (open) {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  container.querySelectorAll(".eq-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const catId = chip.getAttribute("data-eq-cat");
      const opt = chip.getAttribute("data-eq-opt");
      if (!catId || !opt) return;
      const cat = catalog.categories.find((c) => c.id === catId);
      const set = selectedSet(container, catId);
      if (set.has(opt)) {
        set.delete(opt);
        chip.classList.remove("is-on");
        chip.setAttribute("aria-pressed", "false");
      } else {
        if (!cat?.multiple) {
          set.clear();
          container
            .querySelectorAll(`.eq-chip[data-eq-cat="${catId}"]`)
            .forEach((c) => {
              c.classList.remove("is-on");
              c.setAttribute("aria-pressed", "false");
            });
        }
        set.add(opt);
        chip.classList.add("is-on");
        chip.setAttribute("aria-pressed", "true");
      }
      writeSelection(container, catId, set);
    });
  });
}

export function collectEquipmentFromForm(container) {
  const equipment = {};
  container.querySelectorAll("input[data-eq-value]").forEach((inp) => {
    const id = inp.getAttribute("data-eq-value");
    if (!id) return;
    try {
      const arr = JSON.parse(inp.value || "[]");
      if (Array.isArray(arr) && arr.length) equipment[id] = arr;
    } catch {
      /* ignore */
    }
  });
  const trim = container.querySelector('select[name="trim_level"]');
  return {
    trim_level: trim?.value?.trim() || undefined,
    equipment,
  };
}
