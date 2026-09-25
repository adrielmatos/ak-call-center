"use client";

import { useEffect } from "react";

/**
 * Non-invasive presentation layer for the existing A&K operation.
 * It changes readability/touch targets only; it does not change business logic,
 * Supabase queries, Phone Link, dialing, CRM state, or import behavior.
 */
export default function OperationsUx() {
  useEffect(() => {
    const id = "ak-operations-ux";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      :root {
        --ak-font-scale: 1.10;
        --ak-control-scale: 1.06;
      }

      /* Readability: increase operational text without using page zoom. */
      .sidebar nav button { font-size: 13px !important; min-height: 40px; }
      .sidebar nav button i { font-size: 15px; }
      .sidebar .brand b { font-size: 29px; }
      .sidebar .operator b { font-size: 13px; }
      .sidebar .operator small { font-size: 11px; }
      .content .header p, .content .eyebrow { font-size: 12px; }
      .panelTitle h3, .toolbar h3 { font-size: 16px; }
      .panelTitle p, .toolbar p { font-size: 12px; }
      .btn { font-size: 13px; min-height: 40px; }
      .modeBtns button { font-size: 12px; min-height: 38px; }
      .search { font-size: 13px; min-height: 42px; }
      .metric span, .metric small { font-size: 12px; }
      .metric strong { font-size: 27px; }
      .dialHeader { font-size: 12px; }
      .person h2 { font-size: 29px; }
      .person p { font-size: 13px; }
      .dialNumber { font-size: 25px; }
      .callBtn, .dangerBtn { min-height: 42px; font-size: 13px; }
      .resultGrid button { font-size: 12px; min-height: 43px; }
      .info, .notice { font-size: 12px; }
      .tableWrap th, .tableWrap td { font-size: 12px; }
      .tableWrap th { font-size: 10px; }
      .tableWrap td small { font-size: 10px; }
      .tableBtn { font-size: 11px; min-height: 36px; }
      .pill { font-size: 11px; }
      .pagination { font-size: 12px; }
      .leadCard b { font-size: 12px; }
      .leadCard small { font-size: 10px; }
      .campaignCard b { font-size: 12px; }
      .campaignCard small { font-size: 10px; }
      .feature h3 { font-size: 17px; }
      .feature p { font-size: 12px; }
      .barRow { font-size: 12px; }
      .drawer h2 { font-size: 27px; }
      .drawer p { font-size: 12px; }
      .drawerPhone { font-size: 20px; }
      .drawerSection>b { font-size: 11px; }
      .drawerSection button { font-size: 12px; min-height: 40px; }
      .field label { font-size: 11px; }
      .field input { font-size: 13px; min-height: 42px; }
      .check { font-size: 11px; }

      /* Existing bank badge: keep it prominent and stable during navigation. */
      [data-ak-bank-badge] {
        font-size: 13px !important;
        font-weight: 800 !important;
        letter-spacing: .05px;
      }

      /* Better keyboard focus without changing the existing visual language. */
      button:focus-visible, a:focus-visible, input:focus-visible {
        outline: 3px solid rgba(20,107,216,.35) !important;
        outline-offset: 2px;
      }

      @media (max-width: 900px) {
        .content { padding: 20px 18px; }
        .sidebar { width: 220px; }
        .app { grid-template-columns: 220px 1fr; }
      }

      @media (max-width: 700px) {
        .app { display: block; }
        .sidebar { position: relative; height: auto; width: 100%; }
        .content { padding: 18px 14px; }
        .header h1 { font-size: 25px; }
        .person h2 { font-size: 25px; }
        .dialNumber { font-size: 22px; }
        .tableWrap { -webkit-overflow-scrolling: touch; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
