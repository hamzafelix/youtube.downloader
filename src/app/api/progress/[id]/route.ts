import { NextRequest } from "next/server";
import { jobs } from "@/lib/ytdlp";


export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const job = jobs.get(id);
  if (!job) {
    return new Response(JSON.stringify({ error: "Unknown job" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = () => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(publicJob(job))}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      send();
      const interval = setInterval(send, 500);

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
          const done = job.status === "done";
          controller.enqueue(
            encoder.encode(`event: end\ndata: ${JSON.stringify({ done })}\n\n`)
          );
        } catch {
          /* already closed */
        }
      };

      // Poll until the job reaches a terminal state.
      const watcher = setInterval(() => {
        if (job.status === "done" || job.status === "error") finish();
      }, 250);
      setTimeout(() => {
        clearInterval(watcher);
        finish();
      }, 10 * 60 * 1000); // hard cap 10 min per SSE connection
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function publicJob(job: {
  id: string;
  status: string;
  title: string;
  filename: string | null;
  percent: number;
  speed: string | null;
  eta: string | null;
  totalSize: string | null;
  error: string | null;
}) {
  return {
    id: job.id,
    status: job.status,
    title: job.title,
    filename: job.filename,
    percent: job.percent,
    speed: job.speed,
    eta: job.eta,
    totalSize: job.totalSize,
    error: job.error,
  };
}
