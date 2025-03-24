import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";
import { generateJwtToken, getPrivateKey } from "../utils/eth-web3auth";

const tgDataRequest = z.object({
  tg_data: z.string(),
});

export async function ethRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/.well-known/jwks.json", (req, res) => {
    res.send({
      keys: [
        {
          kty: "RSA",
          n: "2d4simxtIQ-XQ-OJbto8aR528PotjPbzsE5PPliZBCs3exU8M52bwkhKi33tt6j5As6PWl6Q6K-gP3f18pYEMnmSkxficjvCpLyfC-nvtAfkPoMRNUzWcecsXYLLV0WLK1wpgBcP5PXs4FeU5NcvszKZvtIpwAjkJUE09Ym3GYvGijhXudEv5Y792j7AIMJwnSUTzKOu5Ssx4sIFbz0YuJunvztvSivKD-6OpW0q74omDbVxpR2he9Ta9OTXydiYAtVgyb4xnbr85qMyIngCDI5X38FSr_cI8r-2ud-MKP5eh5yA9uYiPLhtslOn8LrXNYYpaT2K5eR1eAvoiXKhRw",
          e: "AQAB",
          ext: true,
          kid: process.env.JWT_KEY_ID,
          alg: "RS256",
          use: "sig",
        },
      ],
    });
  });

  // eth - we3auth
  fastify.post("/api/eth_auth", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      if (telegramData.ok) {
        const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
        const user_id = id.toString();
        const user = JSON.parse(telegramData.data.user);
        const JWTtoken = await generateJwtToken(user);
        //console.log("JWTtoken", JWTtoken);
        const ethData = await getPrivateKey(JWTtoken, user_id);
        //console.log("ethData", ethData);
        if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
        const eth_address = (ethData as { ethPublicAddress: string[] }).ethPublicAddress[0];
        await fastify.mongo.db.collection("telegram_users").updateOne({ user_id }, { $set: { eth_address, first_name, last_name, username } }, { upsert: true });
        reply.send({ result: "success", user, JWTtoken, ethData });
      }
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });
}
