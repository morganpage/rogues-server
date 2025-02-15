import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import zod from "zod";
import * as jose from "jose";
import { ethers } from "ethers";

const validateSchema = zod.object({
  appPubKey: zod.string(),
});

export const verify = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const idToken = req.headers.authorization?.split(" ")[1] || "";
    const body = validateSchema.parse(req.body);
    const app_pub_key = body.appPubKey;
    const jwks = jose.createRemoteJWKSet(new URL("https://api.openlogin.com/jwks"));
    const jwtDecoded = await jose.jwtVerify(idToken, jwks, {
      algorithms: ["ES256"],
    });
    const address = ethers.computeAddress("0x" + app_pub_key);
    const public_key = (jwtDecoded.payload as any).wallets[0].public_key;
    if (public_key === app_pub_key) {
      return address;
    } else {
      return null;
    }
  } catch (e: any) {
    return null;
  }
};

export const compress = async (lottieJSON: any) => {
  const stream = new Blob([JSON.stringify(lottieJSON)], { type: "application/json" }).stream();
  const compressedReadableStream = stream.pipeThrough(new CompressionStream("gzip"));
  const compressedResponse = await new Response(compressedReadableStream);
  const blob = await compressedResponse.blob();
  const buffer = await blob.arrayBuffer();
  // convert ArrayBuffer to base64 encoded string
  const lottieCompressedBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return lottieCompressedBase64;
};
