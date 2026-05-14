import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPostJson } from "../api";
import { useAppMe } from "../meContext";

type Listing = {
  title: string;
  description?: string | null;
  price_rub: string | number;
  photoPaths: string[];
};

type DetailResponse = {
  listing: Listing;
  seller: { fullName: string } | null;
  isCompared: boolean;
};

function photoSrc(p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  const path = p.startsWith("/") ? p : `/${p}`;
  return path;
}

function usdApprox(rub: string | number): string {
  const n = typeof rub === "string" ? Number(rub.replace(/\s/g, "")) : rub;
  if (!Number.isFinite(n)) return "—";
  return `≈ $${Math.round(n / 3.25).toLocaleString("en-US")}`;
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const { me, refresh } = useAppMe();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const d = await apiGet<DetailResponse>(`/api/listings/${id}`);
        if (alive) setData(d);
      } catch {
        if (alive) setErr("Не найдено");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function toggleCompare() {
    if (!id || !me?.csrfToken) return;
    await apiPostJson(`/api/listings/${id}/compare`, {}, me.csrfToken);
    await refresh();
    const d = await apiGet<DetailResponse>(`/api/listings/${id}`);
    setData(d);
  }

  if (err || !data) return <p className="muted">{err ?? "Загрузка…"}</p>;

  const { listing, seller, isCompared } = data;
  const paths = Array.isArray(listing.photoPaths) ? listing.photoPaths : [];

  return (
    <article>
      <h1>{listing.title}</h1>
      <p className="price-lg">
        {listing.price_rub} ₽ <span className="usd">{usdApprox(listing.price_rub)}</span>
      </p>
      {seller?.fullName ? <p>Продавец: {seller.fullName}</p> : null}
      <div className="gallery">
        {paths.map((p) => (
          <img key={p} src={photoSrc(p)} alt="" className="gimg" />
        ))}
      </div>
      {listing.description ? (
        <div className="desc">{String(listing.description)}</div>
      ) : null}
      {me?.csrfToken ? (
        <button type="button" className="btn" onClick={() => void toggleCompare()}>
          {isCompared ? "Убрать из сравнения" : "В сравнение"}
        </button>
      ) : null}
    </article>
  );
}
