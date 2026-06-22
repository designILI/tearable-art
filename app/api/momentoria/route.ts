import { NextResponse } from "next/server";
import {
  cleanText,
  saveMomentoriaMetadata,
  type MomentoriaMetadata,
} from "@/lib/momentoria";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      title?: string;
      message?: string;
      recipientName?: string;
      imageUrls?: string[];
    };

    const id = String(body.id ?? "");
    const title = cleanText(body.title ?? "", 80);
    const message = cleanText(body.message ?? "", 220);
    const recipientName = cleanText(body.recipientName ?? "", 60);
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((url) => typeof url === "string") : [];

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN. Add a Vercel Blob token before creating a Momentoria." },
        { status: 500 },
      );
    }

    if (!title || !message) {
      return NextResponse.json({ error: "Add a title and short message." }, { status: 400 });
    }

    if (!/^[a-f0-9]{18}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid Momentoria id." }, { status: 400 });
    }

    if (imageUrls.length !== 5) {
      return NextResponse.json({ error: "Upload exactly 5 images." }, { status: 400 });
    }

    const invalidUrl = imageUrls.find((url) => !url.includes(".public.blob.vercel-storage.com/momentoria/"));
    if (invalidUrl) {
      return NextResponse.json({ error: "One uploaded image URL is not from Vercel Blob." }, { status: 400 });
    }

    const metadata: MomentoriaMetadata = {
      id,
      title,
      message,
      recipientName: recipientName || undefined,
      imageUrls,
      createdAt: new Date().toISOString(),
    };

    await saveMomentoriaMetadata(metadata);

    return NextResponse.json({ id, url: `/m/${id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create this Momentoria." }, { status: 500 });
  }
}
