import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { processTelegramDataMultiToken } from "../utils/telegram";
import { z } from "zod";
import { CooldownsUsers, resetCooldown, TGDataRequest } from "../db/db";

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post("/api/cooldowns-users", async (request: FastifyRequest<{ Params: { event_type: string } }>, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    try {
      const tgDataRequest: TGDataRequest = request.body as TGDataRequest;
      const wasReset = await resetCooldown(fastify, tgDataRequest);
      //const req = TGDataRequest.parse(tgDataRequest);
      const { cooldown_id, cooldown_sub_id } = tgDataRequest;
      console.log(cooldown_id, cooldown_sub_id);

      reply.code(200).send(wasReset);
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });

  fastify.get("/api/cooldowns-users/:user_id/:cooldown_id/:cooldown_sub_id", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const { user_id, cooldown_id, cooldown_sub_id } = request.params;
    console.log("GET", user_id, cooldown_id, cooldown_sub_id);
    const cooldowns_users = await fastify.mongo.db.collection("cooldowns_users").findOne({ user_id, cooldown_id, cooldown_sub_id });
    if (!cooldowns_users) {
      throw new Error("Cooldown not found");
    }
    const secondsLeft = Math.floor((cooldowns_users.lastUpdated.getTime() + cooldowns_users.cooldown_time * 1000 - new Date().getTime()) / 1000);
    reply.code(200).send({ ...cooldowns_users, secondsLeft });
  });
} // end of routes function

export default routes;
