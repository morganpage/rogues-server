import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import zod from "zod";
import { verify } from "../utils/utils";
import { claimHoursAgo, claimStreakFor } from "../contract/streaks";
import { mintGameItemToAddress } from "../contract/minting";

const validateSchema = zod.object({
  appPubKey: zod.string(),
});

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/api/health", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.code(200).send({ status: "ok" });
  });

  fastify.post("/api/streak", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = await verify(req, reply);
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
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.post("/api/mint", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = await verify(req, reply);
      if (address) {
        let mintReply = await mintGameItemToAddress(address, 11, 1);
        if (mintReply.status === "ok") {
          reply.code(200).send(mintReply);
        } else {
          reply.code(400).send(mintReply);
        }
      } else {
        reply.code(401).send({ status: "error", message: "Validation Failed" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.post("/api/validate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = await verify(req, reply);
      if (address) {
        reply.code(200).send({ status: "ok", message: "Validation Success", address });
      } else {
        reply.code(401).send({ status: "error", message: "Validation Failed" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.post("/api/streakHoursAgo", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = await verify(req, reply);
      if (address) {
        let claimedReply = await claimHoursAgo(address, 25);
        if (claimedReply.status === "ok") {
          reply.code(200).send(claimedReply);
        } else {
          reply.code(400).send(claimedReply);
        }
      } else {
        reply.code(401).send({ status: "error", message: "Validation Failed" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });
}

export default routes;
