# Momentoria

Momentoria is a simple full-stack Next.js app for creating a private, tearable image story.

> A memory shared through an unfolding image story.

Users upload exactly 5 images, add a title and short message, and receive a private share link. The share page preserves the original layered tear interaction and fades locally after 3 complete reveals in the same browser.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Three.js for the tearable reveal
- Vercel Blob for uploaded images and MVP metadata JSON

## How Uploads Work

The create form compresses images in the browser before sending them to the API.

1. The route validates the title, message, optional recipient name, and exactly 5 image files.
2. The browser resizes and compresses each image so full-resolution phone photos do not hit Vercel Function payload limits.
3. The browser sends the compressed images as a small JSON payload to avoid multipart parsing issues.
4. The API uploads those compressed images to Vercel Blob under `momentoria/{id}/`.
5. The API saves `metadata.json` to Vercel Blob with the title, message, recipient name, image URLs, and creation time.
6. It returns `/m/{id}` as the private share URL.

This keeps the MVP deployable without a separate database. For a larger product, replace the metadata helpers in `lib/momentoria.ts` with Vercel Postgres, Neon, Supabase, or another database.

## Environment Variables

Create a Vercel Blob store and add this variable locally and in Vercel:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

On Vercel, this is usually added automatically when you connect a Blob store to the project. Locally, put it in `.env.local`.

### Optional Google Sheets Link Log

Momentoria can append each generated private link to a Google Sheet. This is optional: if the Google Sheets variables are missing, Momentoria creation still works and logging is skipped.

1. Create a Google Sheet.
2. Add a tab named `Created Links`.
3. Add these header cells in row 1:

```text
Created At | Momentoria ID | Private Link | Title | Recipient Name | Image Count | Event
```

4. Create a Google Cloud service account with access to the Google Sheets API.
5. Copy the service account email.
6. Share the Google Sheet with that service account email as an editor.
7. Add these variables locally and in Vercel:

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=your_google_sheet_id
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_LINKS_SHEET_NAME="Created Links"
```

`GOOGLE_SHEETS_LINKS_SHEET_NAME` is optional. If omitted, the app uses `Created Links`.

## Local Development

```bash
npm install
npm run dev
```

Visit:

- `http://localhost:3000` for the landing page
- `http://localhost:3000/create` for the upload form
- `http://localhost:3000/m/demo` for a local tearable share preview using the bundled sample images

Creating a real Momentoria locally requires `BLOB_READ_WRITE_TOKEN` from a public Vercel Blob store.

A successful submit is the final proof: it creates five files and `metadata.json` in Vercel Blob, displays the private link, and, when Google Sheets variables are configured, appends the created link to the spreadsheet.

This MVP uses public Blob file URLs behind an unguessable Momentoria share link. In Vercel Storage, choose or create a public Blob store. A private Blob store will reject uploads with `Cannot use public access on a private store`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

Deploy to Vercel as a standard Next.js project.

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Use the `Next.js` framework preset. This app is not a static HTML site anymore, and the homepage is `app/page.tsx`.
4. Leave the output directory empty so Vercel uses Next.js' `.next` build output.
5. Connect a public Vercel Blob store.
6. Confirm `BLOB_READ_WRITE_TOKEN` is present.
7. Deploy.

No accounts, payments, or email sending are included in this MVP.
