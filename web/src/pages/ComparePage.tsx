import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";

type Row = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_rub: string | number;
  city: string | null;
  status: string;
};

const statusRu: Record<string, string> = {
  published: "активно",
  draft: "черновик",
  archived: "архив",
  moderation: "на модерации",
  sold: "продано",
};

export default function ComparePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await apiGet<Row[]>("/api/listings/compare");
        if (alive) setRows(list);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Ошибка");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (err) return <p className="muted">{err}</p>;
  if (!rows) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h1>Сравнение</h1>
      <p className="lead">
        До трёх объявлений сохраняются в сессии на сервере. Ниже — данные из GET /api/listings/compare.
      </p>
      {rows.length === 0 ? (
        <p className="muted">Пока ничего не выбрано. Добавьте объявления с карточки каталога.</p>
      ) : (
        <div className="compare-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                {rows.map((r) => (
                  <th key={r.id}>
                    <Link to={`/listings/${r.id}`}>{r.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Марка</th>
                {rows.map((r) => (
                  <td key={r.id}>{r.brand}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Модель</th>
                {rows.map((r) => (
                  <td key={r.id}>{r.model}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Год</th>
                {rows.map((r) => (
                  <td key={r.id}>{r.year}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Пробег</th>
                {rows.map((r) => (
                  <td key={r.id}>
                    {r.mileage_km != null ? `${r.mileage_km.toLocaleString("ru-RU")} км` : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Цена</th>
                {rows.map((r) => (
                  <td key={r.id}>{r.price_rub} ₽</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Город</th>
                {rows.map((r) => (
                  <td key={r.id}>{r.city ?? "—"}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Статус</th>
                {rows.map((r) => (
                  <td key={r.id}>{statusRu[r.status] ?? r.status}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
