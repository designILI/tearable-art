import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  cleanFileName,
  cleanText,
  saveMomentoriaMetadata,
  type MomentoriaMetadata,
} from "@/lib/momentoria";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN. Add a Vercel Blob token before creating a Momentoria." },
        { status: 500 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "This upload method changed. Refresh the page and try again." }, { status: 415 });
    }

    const body = (await request.json()) as {
      id?: string;
      title?: string;
      message?: string;
      recipientName?: string;
      imageUrls?: string[];
      imageUploads?: Array<{
        data: string;
        name: string;
        type: string;
      }>;
    };

    const id = String(body.id ?? "");
    const title = cleanText(body.title ?? "", 80);
    const message = cleanText(body.message ?? "", 220);
    const recipientName = cleanText(body.recipientName ?? "", 60);
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((url) => typeof url === "string") : [];
    const imageUploads = Array.isArray(body.imageUploads) ? body.imageUploads : [];

    if (!title || !message) {
      return NextResponse.json({ error: "Add a title and short message." }, { status: 400 });
    }

    if (!/^[a-f0-9]{18}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid Momentoria id." }, { status: 400 });
    }

    const savedImageUrls =
      imageUploads.length > 0
        ? await saveBase64Images(id, imageUploads)
        : imageUrls.length === 5
          ? imageUrls
          : [];

    if (savedImageUrls.length !== 5) {
      return NextResponse.json({ error: "Upload exactly 5 images." }, { status: 400 });
    }

    const invalidUrl = savedImageUrls.find((url) => !url.includes(".public.blob.vercel-storage.com/momentoria/"));
    if (invalidUrl) {
      return NextResponse.json({ error: "One uploaded image URL is not from Vercel Blob." }, { status: 400 });
    }

    const metadata: MomentoriaMetadata = {
      id,
      title,
      message,
      recipientName: recipientName || undefined,
      imageUrls: savedImageUrls,
      createdAt: new Date().toISOString(),
    };

    await saveMomentoriaMetadata(metadata);

    return NextResponse.json({ id, url: `/m/${id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: readableError(error) }, { status: 500 });
  }
}

async function saveBase64Images(
  id: string,
  imageUploads: Array<{
    data: string;
    name: string;
    type: string;
  }>,
) {
  if (imageUploads.length !== 5) {
    return [];
  }

  const invalidImage = imageUploads.find((image) => !image.type.startsWith("image/") || !image.data);
  if (invalidImage) {
    throw new Error(`${invalidImage.name || "One file"} is not an image.`);
  }

  const totalBytes = imageUploads.reduce((total, image) => total + Buffer.byteLength(image.data, "base64"), 0);
  if (totalBytes > 3 * 1024 * 1024) {
    throw new Error("Compressed images are still too large. Try smaller images.");
  }

  /*
    The browser compresses images and sends them as base64 JSON. This avoids
    multipart parsing issues on Vercel while keeping the request small enough
    for a serverless function.
  */
  return Promise.all(
    imageUploads.map(async (image, index) => {
      const extension = cleanFileName(image.name).split(".").pop() || "jpg";
      const buffer = Buffer.from(image.data, "base64");
      const blob = await put(`momentoria/${id}/layer-${index + 1}-${crypto.randomUUID()}.${extension}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: image.type,
      });
      return blob.url;
    }),
  );
}

function readableError(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message.includes("Cannot use public access on a private store")) {
      return "This Vercel Blob store is private. Create or connect a public Blob store, redeploy, and try again.";
    }

    return error.message.slice(0, 240);
  }

  return "Could not create this Momentoria.";
}
