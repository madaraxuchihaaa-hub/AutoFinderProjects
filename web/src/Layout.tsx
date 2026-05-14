import { Link, NavLink, Outlet } from "react-router-dom";
import { useAppMe, displayName } from "./meContext";
import { apiPostJson } from "./api";

export default function Layout() {
  const { me, refresh } = useAppMe();

  async function logout() {
    if (!me?.csrfToken) return;
    await apiPostJson("/api/auth/logout", { _csrf: me.csrfToken }, me.csrfToken);
    await refresh();
  }

  const n = me?.compareIds?.length ?? 0;

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-top">
          <Link to="/" className="logo">
            AutoFinder
          </Link>
          <span className="sub">Агрегация и размещение объявлений</span>
        </div>
        <nav className="nav">
          <NavLink to="/listings" end className={({ isActive }) => (isActive ? "a on" : "a")}>
            Каталог
          </NavLink>
          <NavLink to="/compare" className={({ isActive }) => (isActive ? "a on" : "a")}>
            Сравнение ({n})
          </NavLink>
          {me?.user ? (
            <>
              <span className="who">{displayName(me.user)}</span>
              <button type="button" className="btn ghost" onClick={() => void logout()}>
                Выйти
              </button>
            </>
          ) : (
            <NavLink to="/login" className={({ isActive }) => (isActive ? "a on" : "a")}>
              Вход
            </NavLink>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
