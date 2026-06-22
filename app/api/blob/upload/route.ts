import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Missing BLOB_READ_WRITE_TOKEN. Connect Vercel Blob to this project and redeploy." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("momentoria/") || !/\/layer-[1-5]\.[a-z0-9]+$/i.test(pathname)) {
          throw new Error("Invalid upload path.");
        }

        /*
          This route does not receive the full file. It only grants a short-lived
          client token so the browser can upload directly to Vercel Blob. That
          avoids Vercel Function body-size limits for large photos.
        */
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
          maximumSizeInBytes: MAX_IMAGE_SIZE,
          addRandomSuffix: false,
        };
      },
      onUploadCompleted: async () => {
        // Metadata is saved after all five client uploads finish.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare this Blob upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
