"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTelegramDataMultiToken = processTelegramDataMultiToken;
const crypto_1 = require("crypto");
function hmac(data, key) {
    return (0, crypto_1.createHmac)("sha256", key).update(data).digest();
}
function processTelegramData(qs, token) {
    const sk = hmac(token, "WebAppData");
    const parts = qs.split("&").map((p) => p.split("="));
    const hashpart = parts.splice(parts.findIndex((p) => p[0] === "hash"), 1)[0];
    const dcs = parts
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map((p) => decodeURIComponent(p.join("=")))
        .join("\n");
    if (hmac(dcs, sk).toString("hex") !== hashpart[1])
        return { ok: false };
    const o = {};
    for (const part of parts) {
        o[part[0]] = decodeURIComponent(part[1]);
    }
    return { ok: true, data: o };
}
function processTelegramDataMultiToken(qs) {
    let p1 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN);
    if (p1.ok)
        return p1;
    if (!process.env.TELEGRAM_BOT_TOKEN_2)
        return p1;
    let p2 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN_2);
    if (p2.ok)
        return p2;
    if (!process.env.TELEGRAM_BOT_TOKEN_3)
        return p2;
    let p3 = processTelegramData(qs, process.env.TELEGRAM_BOT_TOKEN_3);
    return p3;
}
