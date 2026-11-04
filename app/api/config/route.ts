import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

  if (!url || !key) {
    return NextResponse.json(
      { configured: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { configured: true, url, key },
    { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
