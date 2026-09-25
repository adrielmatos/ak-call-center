"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

function digits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function extractBank(row: any): string {
  const extras = row?.dados_extras && typeof row.dados_extras === "object" ? row.dados_extras : {};
  const imported = extras?._importacao;
  const directKeys = [
    "Banco", "BANCO", "banco", "Banco Atual", "Banco do Benefício",
    "Banco do Beneficio", "Instituição Financeira", "Instituicao Financeira", "Bank"
  ];

  for (const key of directKeys) {
    const value = extras?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  if (imported && typeof imported.banco === "string" && imported.banco.trim()) {
    return imported.banco.trim();
  }

  const produto = String(row?.produto || "");
  const match = produto.match(/Banco\s*:\s*([^•|]+)/i);
  return match?.[1]?.trim() || "";
}

function findPhone(): string {
  const node = document.querySelector(".dialNumber");
  return digits(node?.textContent || "");
}

const cacheKey = (phone: string) => `ak:bank:${phone}`;

export default function BankBadge() {
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastPhone = "";

    const clearBadge = () => {
      document.querySelectorAll("[data-ak-bank-badge]").forEach((node) => node.remove());
    };

    const render = (bank: string) => {
      clearBadge();
      if (!bank || disposed) return;
      const person = document.querySelector(".person");
      if (!person) return;
      const target = person.querySelector("p");
      if (!target) return;

      const badge = document.createElement("div");
      badge.dataset.akBankBadge = "true";
      badge.textContent = `🏦 ${bank}`;
      badge.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "margin-top:6px",
        "padding:5px 9px",
        "border:1px solid rgba(59,130,246,.28)",
        "border-radius:999px",
        "background:rgba(59,130,246,.08)",
        "color:inherit",
        "font-size:12px",
        "font-weight:700",
        "line-height:1.2"
      ].join(";");
      target.insertAdjacentElement("afterend", badge);
    };

    const readCache = (phone: string) => {
      try {
        return sessionStorage.getItem(cacheKey(phone)) || "";
      } catch {
        return "";
      }
    };

    const writeCache = (phone: string, bank: string) => {
      if (!phone || !bank) return;
      try {
        sessionStorage.setItem(cacheKey(phone), bank);
      } catch {
        // Cache is an optimization only; database remains the source of truth.
      }
    };

    const load = async () => {
      const phone = findPhone();
      if (!phone) {
        lastPhone = "";
        clearBadge();
        return;
      }

      const badgeExists = Boolean(document.querySelector("[data-ak-bank-badge]"));
      if (phone === lastPhone && badgeExists) return;
      lastPhone = phone;

      const cachedBank = readCache(phone);
      if (cachedBank) render(cachedBank);
      else clearBadge();

      // When returning from CRM, the component can remain mounted and the
      // same phone can come back without a new component lifecycle. We must
      // still restore the badge instead of skipping because the phone is the same.
      if (!supabase) return;

      const { data: phones, error: phoneError } = await supabase
        .from("telefones")
        .select("lead_id")
        .eq("numero_normalizado", phone)
        .eq("ativo", true)
        .limit(1);

      if (disposed || phoneError || !phones?.[0]?.lead_id) return;

      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("produto,dados_extras")
        .eq("id", phones[0].lead_id)
        .maybeSingle();

      if (disposed || leadError) return;
      const bank = extractBank(lead);
      writeCache(phone, bank);
      render(bank);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 120);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      observer.disconnect();
      clearBadge();
    };
  }, []);

  return null;
}
