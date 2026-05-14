import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";

type Item = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_rub: string | number;
  city: string | null;
  status: string;
  images: string[];
};

function photoSrc(p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/") ? p : `/${p}`;
}

type Page = { items: Item[]; total: number; page: number; limit: number };

const statusRu: Record<string, string> = {
  published: "активно",
  draft: "черновик",
  archived: "архив",
  moderation: "на модерации",
  sold: "продано",
};

function usdApprox(rub: string | number): string {
  const n = typeof rub === "string" ? Number(rub.replace(/\s/g, "")) : rub;
  if (!Number.isFinite(n)) return "—";
  return `≈ $${Math.round(n / 3.25).toLocaleString("en-US")}`;
}

export default function ListingsPage() {
  const [data, setData] = useState<Page | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await apiGet<Page>("/api/listings?page=1");
        if (alive) setData(p);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (err) return <p className="muted">{err}</p>;
  if (!data) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Каталог</h1>
      <p className="lead">Найдено: {data.total}</p>
      <div className="grid">
        {data.items.map((it) => {
          const img = it.images?.[0];
          const titleShort =
            it.title.length > 90 ? `${it.title.slice(0, 87)}…` : it.title;
          return (
            <Link key={it.id} to={`/listings/${it.id}`} className="card">
              <div className="thumb">
                {img ? (
                  <img src={photoSrc(img)} alt="" />
                ) : (
                  <span className="ph">Нет фото</span>
                )}
              </div>
              <div className="badges">
                <span className="badge">{statusRu[it.status] ?? it.status}</span>
              </div>
              <div className="t2">
                {it.brand} {it.model}
              </div>
              <div className="price">
                {it.price_rub} ₽ <span className="usd">{usdApprox(it.price_rub)}</span>
              </div>
              <div className="meta">
                {it.year}
                {it.mileage_km != null ? ` · ${it.mileage_km.toLocaleString("ru-RU")} км` : ""}
              </div>
              <div className="meta">{it.city ?? ""}</div>
              <p className="snippet">{titleShort}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
