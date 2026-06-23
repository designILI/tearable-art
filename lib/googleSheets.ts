import { createSign } from "crypto";

type CreatedMomentoriaLog = {
  id: string;
  title: string;
  recipientName?: string;
  makerEmail?: string;
  createdAt: string;
  shareUrl: string;
  imageCount: number;
};

type MomentoriaEventLog = {
  id: string;
  event: string;
  eventAt: string;
  shareUrl: string;
};

const tokenUrl = "https://oauth2.googleapis.com/token";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";

export async function logCreatedMomentoriaToSheet(entry: CreatedMomentoriaLog) {
  await appendMomentoriaSheetRow([
    entry.createdAt,
    entry.id,
    entry.shareUrl,
    entry.title,
    entry.recipientName || "",
    entry.makerEmail || "",
    entry.imageCount,
    "created",
  ]);
}

export async function logMomentoriaEventToSheet(entry: MomentoriaEventLog) {
  await appendMomentoriaSheetRow([entry.eventAt, entry.id, entry.shareUrl, "", "", "", "", entry.event]);
}

async function appendMomentoriaSheetRow(values: Array<string | number>) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  const sheetName = process.env.GOOGLE_SHEETS_LINKS_SHEET_NAME || "Created Links";

  if (!spreadsheetId || !clientEmail || !privateKey) {
    return;
  }

  /*
    This uses a Google service account to append one row whenever a Momentoria is
    created. If the Sheets env vars are absent, logging is skipped so the core
    upload/share flow still works without analytics.
  */
  const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
  const range = encodeURIComponent(`${sheetName}!A:H`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Sheets logging failed: ${response.status} ${await response.text()}`);
  }
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT",
    },
    {
      iss: clientEmail,
      scope: sheetsScope,
      aud: tokenUrl,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
  );

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(5000),
  });

  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Could not authorize Google Sheets logging.");
  }

  return data.access_token;
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(privateKey, "base64url")}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n");
}
