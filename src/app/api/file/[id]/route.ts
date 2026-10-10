import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { jobs, DOWNLOADS_DIR } from "@/lib/ytdlp";


export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = jobs.get(id);
  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }
  if (job.status !== "done" || !job.filename) {
    return NextResponse.json(
      { error: "Download not finished yet." },
      { status: 409 }
    );
  }

  const filePath = path.join(DOWNLOADS_DIR, job.filename);
  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "File missing on disk (it may have been moved or deleted)." },
      { status: 410 }
    );
  }

  const stat = statSync(filePath);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const encodedName = encodeURIComponent(job.filename);

  const nodeStream = createReadStream(filePath);
  return new Response(nodeStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
