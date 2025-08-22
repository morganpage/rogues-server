import { createHmac, createHash } from "crypto";
import { ethers } from "ethers";

function hmac(data: string, key: string | Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function processTelegramData(qs: string, token: string): { ok: false } | { ok: true; data: Record<string, string> } {
  const sk = hmac(token, "WebAppData");
  const parts = qs.split("&").map((p) => p.split("="));
  const hashpart = parts.splice(
    parts.findIndex((p) => p[0] === "hash"),
    1
  )[0];
  const dcs = parts
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map((p) => decodeURIComponent(p.join("=")))
    .join("\n");
  if (hmac(dcs, sk).toString("hex") !== hashpart[1]) return { ok: false };
  const o: Record<string, string> = {};
  for (const part of parts) {
    o[part[0]] = decodeURIComponent(part[1]);
  }
  return { ok: true, data: o };
}

export function processTelegramDataMultiToken(qs: string): { ok: false } | { ok: true; data: Record<string, string> } {
  if (qs.startsWith("farcasteruser=")) {
    let p1 = processFarcasterData(qs);
    return p1;
  }

  if (qs.startsWith("webuser=")) {
    let p1 = processTelegramDataWebAuth(qs, process.env.TELEGRAM_BOT_TOKEN!);
    if (p1.ok) return p1;
    if (!process.env.TELEGRAM_BOT_TOKEN_2) return p1;
    let p2 = processTelegramDataWebAuth(qs, process.env.TELEGRAM_BOT_TOKEN_2!);
    if (p2.ok) return p2;
    if (!process.env.TELEGRAM_BOT_TOKEN_3) return p2;
    let p3 = processTelegramDataWebAuth(qs, process.env.TELEGRAM_BOT_TOKEN_3!);
    return p3;
  } else {
    let p1 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN!);
    if (p1.ok) return p1;
    if (!process.env.TELEGRAM_BOT_TOKEN_2) return p1;
    let p2 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN_2!);
    if (p2.ok) return p2;
    if (!process.env.TELEGRAM_BOT_TOKEN_3) return p2;
    let p3 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN_3!);
    return p3;
  }
}

export function processTelegramDataWebAuth(qs: string, token: string): { ok: false } | { ok: true; data: Record<string, string> } {
  try {
    //remove the "webuser=" prefix if it exists
    if (qs.startsWith("webuser=")) {
      qs = qs.substring("webuser=".length);
    }
    const decoded_tg_data = decodeURIComponent(qs);
    const userData = JSON.parse(decoded_tg_data);
    const receivedHash = userData.hash;
    const dataCheckString = Object.keys(userData)
      .sort()
      .filter((key) => key !== "hash")
      .map((key) => `${key}=${userData[key]}`)
      .join("\n");
    //console.log("Data check string:", dataCheckString);
    const secretKey = createHash("sha256").update(token).digest(); //Generate the secret_key (SHA256 hash of the bot's token) [1]
    const hmac = createHmac("sha256", secretKey); //Calculate the HMAC-SHA-256 signature [1]
    hmac.update(dataCheckString);
    const calculatedHash = hmac.digest("hex"); // Get hexadecimal representation [1]
    //console.log("Calculated hash:", calculatedHash + " | Received hash: " + receivedHash);
    if (calculatedHash !== receivedHash) {
      return { ok: false };
    }
    return { ok: true, data: { user: JSON.stringify(userData), auth_date: userData.auth_date.toString() } };
  } catch (e) {
    console.error("Error processing Telegram data:", e);
    return { ok: false };
  }
}

export function processFarcasterData(qs: string): { ok: false; error?: string } | { ok: true; data: Record<string, string> } {
  if (qs.startsWith("farcasteruser=")) {
    qs = qs.substring("farcasteruser=".length);
    const decoded_tg_data = decodeURIComponent(qs);
    const userData = JSON.parse(decoded_tg_data);
    const { fid, custody, message, signature } = userData;
    if (!fid || !custody) return { ok: false, error: "Missing fid or custody" };
    const signer = ethers.verifyMessage(message, signature);
    if (!signer) return { ok: false, error: "Invalid signature" };
    if (signer !== custody) return { ok: false, error: "Signature does not match custody" };
    //console.log("Farcaster data processed successfully:", signer, custody);
    userData.id = "farcaster_" + fid;
    if (userData?.user?.displayName) userData.first_name = userData.user.displayName;
    if (userData?.user?.pfpUrl) userData.photo_url = userData.user.pfpUrl;
    return { ok: true, data: { user: JSON.stringify(userData) } };
  }
  return { ok: false };
}
