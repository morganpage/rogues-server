import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";
import { generateJwtToken, getPrivateKey } from "../utils/eth-web3auth";
import { claimStreakFor } from "../contract/streaks";
import { getStreakStatusDB } from "../contract/streaksdb";
import { getStreakToPoints } from "../db/db";
import { syncReactive } from "../contract/streaks-reactive";

const tgDataRequest = z.object({
  tg_data: z.string(),
});

const tgDataCooldownRequest = z.object({
  tg_data: z.string(),
  cooldown_type: z.string(),
  cooldown_index: z.number(),
  cooldownFor: z.boolean().optional(),
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
          //User exists and has eth address, let's update rogues users with the new data if it exists
          await fastify.mongo.db.collection("rogues_users").updateOne({ address: telegram_user.eth_address }, { $set: { first_name, last_name, username, user_id, lastLogin: new Date() } });
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

  fastify.post("/api/tg/streak_claim_db", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      if (telegramData.ok) {
        const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
        const user_id = id.toString();
        //Lookup user eth address from db
        if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
        const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
        if (!telegram_user || !telegram_user.eth_address) {
          reply.code(401).send({ status: "error", message: "User not found or eth address not set" });
          return;
        }
        let { streak = 0, timeUntilCanClaim = 0, timeUntilStreakReset = 0 } = await getStreakStatusDB(fastify, telegram_user.eth_address);
        if (timeUntilStreakReset <= 0) {
          // If timeUntilStreakReset is 0, it means the user has lost their streak or this is their first streak claim
          const now = new Date();
          const points: number = await getStreakToPoints(fastify, 1);
          await fastify.mongo.db.collection("rogues_users").updateOne({ address: telegram_user.eth_address }, { $set: { lastClaimed: now, streak: 1 }, $inc: { points } }, { upsert: true });
          let streakInfo = await getStreakStatusDB(fastify, telegram_user.eth_address);
          syncReactive(fastify, telegram_user.eth_address, streakInfo); // Sync with reactive system
          reply.code(200).send({ status: "ok", message: "Streak reset successfully", streakInfo });
          return;
        }
        if (timeUntilCanClaim > 0) {
          reply.code(400).send({ status: "error", message: "You can't claim yet", timeUntilCanClaim, streak, timeUntilStreakReset });
          return;
        } else {
          // Update lastClaimed and increment streak
          const now = new Date();
          // Get points from streak
          const points: number = await getStreakToPoints(fastify, streak);
          console.log("User ", telegram_user.eth_address, " claimed streak ", streak, " for ", points, " points");
          await fastify.mongo.db.collection("rogues_users").updateOne({ address: telegram_user.eth_address }, { $set: { lastClaimed: now }, $inc: { streak: 1, points } });
          let streakInfo = await getStreakStatusDB(fastify, telegram_user.eth_address);
          syncReactive(fastify, telegram_user.eth_address, streakInfo); // Sync with reactive system
          // streak += 1; // Increment the streak count
          reply.code(200).send({ status: "ok", message: "Streak claimed successfully", streakInfo });
          return;
        }
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  // fastify.post("/api/tg/cooldown", async (request: FastifyRequest, reply: FastifyReply) => {
  //   try {
  //     const req = tgDataCooldownRequest.parse(request.body);
  //     const cooldownType = req.cooldown_type; // ie Tree
  //     const cooldownIndex = req.cooldown_index; // ie 0
  //     const cooldownFor = req.cooldownFor; // ie true
  //     const telegramData = processTelegramDataMultiToken(req.tg_data);
  //     if (telegramData.ok) {
  //       const user = JSON.parse(telegramData.data.user);
  //       if (cooldownFor) {
  //         console.log("cooldownFor", cooldownFor);
  //         const user_id = user.id.toString();
  //         if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  //         const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
  //         if (!telegram_user || !telegram_user.eth_address) {
  //           reply.code(401).send({ status: "error", message: "User not found or eth address not set" });
  //         } else {
  //           const address = telegram_user.eth_address;
  //           console.log("address", address);
  //           if (address) {
  //             let cooldown = await startCooldownFor(address, cooldownType, cooldownIndex);
  //             if (cooldown.status === "ok") {
  //               reply.code(200).send(cooldown);
  //             } else {
  //               reply.code(400).send(cooldown);
  //             }
  //           }
  //         }
  //       } else {
  //         console.log("cooldownFor", cooldownFor);
  //         const cooldown = await startCooldown(user, cooldownType, cooldownIndex);
  //         if (cooldown.status === "ok") {
  //           reply.code(200).send(cooldown);
  //         } else {
  //           reply.code(400).send(cooldown);
  //         }
  //       }
  //     }
  //     reply.send({ result: "success" });
  //   } catch (e) {
  //     reply.send({ result: "error", error: e });
  //   }
  // });

  fastify.get("/api/rogues_users", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const address = (request.query as { address?: string }).address as string;
    if (address) {
      const rogues_user = await fastify.mongo.db.collection("rogues_users").findOne({ address });
      if (!rogues_user) {
        reply.code(404).send({ status: "error", message: "User not found" });
      }
      reply.code(200).send(rogues_user);
    } else {
      const rogues_users = await fastify.mongo.db.collection("rogues_users").find({}).toArray();
      reply.code(200).send(rogues_users);
    }
  });

  fastify.get("/api/recentlogin", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const user_id = (request.query as { user_id?: string }).user_id as string;
    if (!user_id) {
      reply.code(400).send({ status: "error", message: "user_id is required", recent: false });
      return;
    }
    const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
    if (!telegram_user) {
      reply.code(404).send({ status: "error", message: "Telegram User not found", recent: false });
      return;
    }
    const rogues_user = await fastify.mongo.db.collection("rogues_users").findOne({ address: telegram_user.eth_address });
    if (!rogues_user) {
      reply.code(404).send({ status: "error", message: "Rogues User not found", recent: false });
      return;
    }
    //Check if lastLogin exists
    if (!rogues_user.lastLogin) {
      reply.code(404).send({ status: "error", message: "lastLogin not found", recent: false });
      return;
    }
    const lastLogin = rogues_user.lastLogin;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(lastLogin).getTime()) / 1000);
    reply.code(200).send({ status: "ok", lastLogin: rogues_user.lastLogin, diffInSeconds, recent: diffInSeconds < 60 * 60 ? true : false });
  });

  fastify.get("/api/rank", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    //Order by points desc, ignore 0 points, username must exist but can be null
    const rogues_users = await fastify.mongo.db
      .collection("rogues_users")
      .find({ points: { $gt: 0 }, username: { $exists: true } })
      .sort({ points: -1 })
      .toArray();
    reply.code(200).send(rogues_users);
  });
}
