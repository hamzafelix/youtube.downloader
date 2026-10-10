import { NextRequest, NextResponse } from "next/server";
import { jobs } from "@/lib/ytdlp";


export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = jobs.get(id);
  if (!job) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }
  if (job.process) {
    job.process.kill();
    job.process = null;
  }
  if (job.status !== "done" && job.status !== "error") {
    job.status = "error";
    job.error = "Cancelled by user";
  }
  return NextResponse.json({ ok: true, status: job.status });
}
