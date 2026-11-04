"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/dialer");
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        const authCode = String((error as any).code || "");
        const authMessage = String(error.message || "");
        if (authCode === "email_not_confirmed" || /email not confirmed/i.test(authMessage)) {
          setErrorMsg("Esta conta antiga está pendente de confirmação. O administrador precisa regularizar o cadastro; o sistema não enviará e-mail de confirmação.");
        } else if (/invalid login credentials/i.test(authMessage)) {
          setErrorMsg("E-mail ou senha não conferem. Confira os dados ou solicite ao administrador a redefinição da senha.");
        } else {
          setErrorMsg(authMessage || "Erro ao realizar login.");
        }
        return;
      }

      if (data.user) {
        setSuccessMsg("Acesso autorizado! Abrindo o sistema...");
        setTimeout(() => router.push("/dialer"), 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado ao conectar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10">
        <div className="mb-6 flex justify-between items-center text-xs">
          <Link href="/" className="text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors font-medium group">
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar ao site</span>
          </Link>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Acesso Operacional</span>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600 text-white font-bold text-xl mb-4 shadow-lg shadow-blue-500/20">AK</div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">A&K Soluções Financeiras</h1>
          <p className="text-xs text-slate-400 mt-1.5">Plataforma Segura de Call Center & CRM</p>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-rose-950/40 border border-rose-800/80 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs flex items-start space-x-2 animate-in fade-in">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">E-mail de Acesso</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                type="email"
                required
                placeholder="exemplo@aksolucoes.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-600/20 disabled:opacity-60 cursor-pointer mt-2"
          >
            <span>{loading ? "Autenticando..." : "Entrar no Sistema"}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Criptografia Ponta a Ponta • Proteção LGPD</span>
        </div>
      </div>
    </div>
  );
}
