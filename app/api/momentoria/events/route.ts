import { NextResponse } from "next/server";
import { logMomentoriaEventToSheet } from "@/lib/googleSheets";

export const runtime = "nodejs";

const trackedEvents = new Set(["clicked_cycle_again", "clicked_make_own", "clicked_save_permanently"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      event?: string;
    };
    const id = String(body.id ?? "");
    const event = String(body.event ?? "");

    if (!/^[a-f0-9]{18}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid Momentoria id." }, { status: 400 });
    }

    if (!trackedEvents.has(event)) {
      return NextResponse.json({ error: "Invalid tracking event." }, { status: 400 });
    }

    await logMomentoriaEventToSheet({
      id,
      event,
      eventAt: new Date().toISOString(),
      shareUrl: new URL(`/m/${id}`, request.url).toString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not log Momentoria event.", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
