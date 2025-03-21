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
      reply.code(200).send(wasReset);
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });

  fastify.get("/api/cooldowns-users/:user_id/:cooldown_id/:cooldown_sub_id", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const { user_id, cooldown_id, cooldown_sub_id } = request.params;
    const cooldowns_users = await fastify.mongo.db.collection("cooldowns_users").findOne({ user_id, cooldown_id, cooldown_sub_id });
    if (!cooldowns_users) {
      //throw new Error("Cooldown not found");
      //Cooldown doesn't exist yet but lets check that the cooldown_id and cooldown_sub_id are valid
      const cooldowns = await fastify.mongo.db.collection("cooldowns").findOne({ cooldown_id });
      if (!cooldowns) {
        console.log("Cooldown not found", cooldown_id);
        return reply.code(404).send({ error: "Cooldown not found" });
      }
      const { max_sub_id, cooldown_time } = cooldowns;
      //Now check that the cooldown_sub_id is valid, must be less than or equal to the max_sub_id
      if (parseInt(cooldown_sub_id) > max_sub_id) {
        console.log("Invalid cooldown_sub_id", cooldown_sub_id, max_sub_id);
        return reply.code(404).send({ error: "Invalid cooldown_sub_id" });
      }
      return reply.code(200).send({ user_id, cooldown_id, cooldown_sub_id, cooldown_time, secondsLeft: 0 });
    }
    const secondsLeft = Math.floor((cooldowns_users.lastUpdated.getTime() + cooldowns_users.cooldown_time * 1000 - new Date().getTime()) / 1000);
    reply.code(200).send({ ...cooldowns_users, secondsLeft });
  });

  fastify.get("/api/cooldowns-users/:user_id", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const { user_id } = request.params;
    const cooldowns_users = await fastify.mongo.db.collection("cooldowns_users").find({ user_id }).toArray();
    //Add secondsLeft to each cooldown
    const now = new Date().getTime();
    cooldowns_users.forEach((cooldown) => {
      const secondsLeft = Math.floor((cooldown.lastUpdated.getTime() + cooldown.cooldown_time * 1000 - now) / 1000);
      cooldown.secondsLeft = secondsLeft;
    });
    reply.code(200).send(cooldowns_users);
  });
} // end of routes function

export default routes;
