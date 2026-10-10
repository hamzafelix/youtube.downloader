import { NextRequest, NextResponse } from "next/server";
import { fetchInfo } from "@/lib/ytdlp";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "A url field is required." }, { status: 400 });
    }
    const info = await fetchInfo(url);
    return NextResponse.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
