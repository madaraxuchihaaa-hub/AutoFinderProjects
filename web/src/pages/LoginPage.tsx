import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppMe } from "../meContext";

export default function LoginPage() {
  const { me, refresh } = useAppMe();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me?.user) {
      nav("/listings", { replace: true });
    }
  }, [me, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setErr("Неверный email или пароль");
        return;
      }
      await refresh();
      nav("/listings");
    } catch {
      setErr("Неверный email или пароль");
    }
  }

  if (me?.user) {
    return null;
  }

  return (
    <div className="narrow">
      <h1>Вход</h1>
      <form onSubmit={onSubmit} className="form">
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Пароль
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {err ? <p className="err">{err}</p> : null}
        <button type="submit" className="btn primary">
          Войти
        </button>
      </form>
    </div>
  );
}
