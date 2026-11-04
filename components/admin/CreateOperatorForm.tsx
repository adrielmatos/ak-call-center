"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateOperatorForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState("operador");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, perfil, ativo: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o usuário.");

      setMessage("Usuário criado e confirmado. Já pode entrar com o e-mail e a senha cadastrados; nenhum e-mail de confirmação será enviado.");
      setNome("");
      setEmail("");
      setSenha("");
      setPerfil("operador");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ border: "1px solid #dbe2ea", borderRadius: 14, padding: 20, maxWidth: 900, marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Cadastrar novo usuário</h2>
      <p style={{ color: "#64748b", marginBottom: 16, fontSize: 14 }}>
        O acesso é liberado imediatamente após salvar. Não há confirmação por e-mail.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Nome completo
          <input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 12px", color: "#0f172a" }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          E-mail de acesso
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 12px", color: "#0f172a" }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Senha inicial
          <input required type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 12px", color: "#0f172a" }} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
          Perfil de acesso
          <select value={perfil} onChange={(e) => setPerfil(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 12px", color: "#0f172a", background: "white" }}>
            <option value="operador">Operador</option>
            <option value="gestor">Gestor</option>
          </select>
        </label>
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" disabled={loading} style={{ background: "#2563eb", color: "white", border: 0, borderRadius: 9, padding: "12px 18px", fontWeight: 700, opacity: loading ? 0.65 : 1, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Cadastrando..." : "Cadastrar e liberar acesso"}
          </button>
          {message && <span role="status" style={{ color: "#047857", fontSize: 13 }}>{message}</span>}
          {error && <span role="alert" style={{ color: "#be123c", fontSize: 13 }}>{error}</span>}
        </div>
      </form>
    </section>
  );
}
