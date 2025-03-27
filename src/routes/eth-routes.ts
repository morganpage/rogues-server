import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";
import { generateJwtToken, getPrivateKey } from "../utils/eth-web3auth";
import { claimStreakFor } from "../contract/streaks";

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

  // eth - we3auth - returns the eth address if exists, otherwise generates one
  fastify.post("/api/eth_auth", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      if (telegramData.ok) {
        const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
        const user_id = id.toString();
        const user = JSON.parse(telegramData.data.user);
        //Now lookup user in db
        if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
        const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
        if (telegram_user && telegram_user.eth_address) {
          reply.send({ result: "success", user, ethData: { ethPublicAddress: [telegram_user.eth_address] } });
        } else {
          const JWTtoken = await generateJwtToken(user);
          //console.log("JWTtoken", JWTtoken);
          const ethData = await getPrivateKey(JWTtoken, user_id);
          //console.log("ethData", ethData);
          const eth_address = (ethData as { ethPublicAddress: string[] }).ethPublicAddress[0];
          await fastify.mongo.db.collection("telegram_users").updateOne({ user_id }, { $set: { eth_address, first_name, last_name, username } }, { upsert: true });
          reply.send({ result: "success", user, JWTtoken, ethData });
        }
      }
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });

  fastify.post("/api/tg/streak", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      if (telegramData.ok) {
        const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
        const user_id = id.toString();
        //Lookup user eth address from db
        if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
        const user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
        if (!user || !user.eth_address) {
          reply.code(401).send({ status: "error", message: "User not found or eth address not set" });
        } else {
          const address = user.eth_address;
          if (address) {
            let claimedReply = await claimStreakFor(address);
            if (claimedReply.status === "ok") {
              reply.code(200).send(claimedReply);
            } else {
              reply.code(400).send(claimedReply);
            }
          } else {
            reply.code(401).send({ status: "error", message: "Validation Failed" });
          }
        }
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });
}
