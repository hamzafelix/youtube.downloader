import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { jobs, startDownload } from "@/lib/ytdlp";
import { parseAdvancedSettings } from "@/lib/settings";


const VALID_QUALITIES = ["best", "1080", "720", "480", "audio"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const quality = typeof body.quality === "string" ? body.quality : "best";
    const advanced = parseAdvancedSettings(body.advanced);

    if (!url) {
      return NextResponse.json({ error: "A url field is required." }, { status: 400 });
    }
    if (!VALID_QUALITIES.includes(quality)) {
      return NextResponse.json({ error: "Unknown quality preset." }, { status: 400 });
    }

    const jobId = randomUUID();
    jobs.set(jobId, {
      id: jobId,
      url,
      quality,
      status: "starting",
      title: "",
      filename: null,
      percent: 0,
      speed: null,
      eta: null,
      totalSize: null,
      log: [],
      error: null,
      createdAt: Date.now(),
      process: null,
    });

    startDownload({ url, quality, jobId, advanced });
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
