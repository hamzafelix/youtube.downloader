import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import path from "path";
import { jobs, STAGING_DIR, deleteStagedFile } from "@/lib/ytdlp";


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

  const filePath = path.join(STAGING_DIR, job.filename);
  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "File was already delivered and removed from the server." },
      { status: 410 }
    );
  }

  const stat = statSync(filePath);
  const encodedName = encodeURIComponent(job.filename);

  const nodeStream = createReadStream(filePath);
  // The staged copy is transient: once the browser has pulled the bytes
  // (or abandoned the transfer), the file is removed from the server.
  nodeStream.on("close", () => {
    // Small delay so the last chunk is definitely flushed before unlink.
    setTimeout(() => deleteStagedFile(job.filename), 1000);
  });

  return new Response(nodeStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
