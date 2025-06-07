import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import zod from "zod";
import { verify } from "../utils/utils";
import { claimHoursAgo, claimStreakFor, getStreakMilestonesToTokensIds, getStreakRewardContractAddress, getStreakStatus } from "../contract/streaks";
import { getURIFromTokenId, mintGameItemToAddress } from "../contract/minting";
import { getAllStreakToPoints, getStreakToPoints, updateUserLastLogin } from "../db/db";
import { getStreakStatusDB } from "../contract/streaksdb";
import { getStreakStatusReactive } from "../contract/streaks-reactive";

const validateSchema = zod.object({
  appPubKey: zod.string(),
});

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/api/health", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.code(200).send({ status: "ok" });
  });

  fastify.post("/api/user_last_login", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = await verify(req, reply);
      if (address) {
        await updateUserLastLogin(fastify, address);
        reply.code(200).send({ status: "ok", message: "User Last Login Updated" });
      } else {
        reply.code(401).send({ status: "error", message: "Validation Failed" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
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

  fastify.get("/api/streak_to_points", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const streak = (req.query as { streak?: number }).streak as number;
      if (streak) {
        let points = await getStreakToPoints(fastify, streak);
        reply.code(200).send({ status: "ok", points });
      } else {
        let streak_to_points = await getAllStreakToPoints(fastify);
        reply.code(200).send(streak_to_points);
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });
  fastify.get("/api/streak_info", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = (req.query as { address?: string }).address as string;
      if (address) {
        let streakInfo = await getStreakStatus(address);
        reply.code(200).send({ status: "ok", streakInfo });
      } else {
        reply.code(400).send({ status: "error", message: "Address required" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.get("/api/streak_info_reactive", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = (req.query as { address?: string }).address as string;
      if (address) {
        let streakInfo = await getStreakStatusReactive(address);
        reply.code(200).send({ status: "ok", streakInfo });
      } else {
        reply.code(400).send({ status: "error", message: "Address required" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.get("/api/streak_info_db", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const address = (req.query as { address?: string }).address as string;
      if (address) {
        let streakInfo = await getStreakStatusDB(fastify, address);
        reply.code(200).send({ status: "ok", streakInfo });
      } else {
        reply.code(400).send({ status: "error", message: "Address required" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  fastify.get("/api/gameItemFromTokenId", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tokenId = (req.query as { tokenId?: number }).tokenId as number;
      if (tokenId) {
        let uri = await getURIFromTokenId(tokenId);
        uri = uri.replace("ipfs://", "https://roguefoxguild.mypinata.cloud/ipfs/");
        const response = await fetch(uri).then((res) => res.json());
        response.image = response.image.replace("ipfs://", "https://roguefoxguild.mypinata.cloud/ipfs/");
        reply.code(200).send({ status: "ok", ...response });
      } else {
        reply.code(400).send({ status: "error", message: "TokenId required" });
      }
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  //Get all the token milestone mappings - getStreakTokenMilestones
  fastify.get("/api/streak_milestones_to_tokenIds", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      let milestones_tokens = await getStreakMilestonesToTokensIds();
      let milestones = milestones_tokens[0].map((milestone: any) => parseInt(milestone));
      let tokens = milestones_tokens[1].map((token: any) => parseInt(token));
      let mapping_array = [];
      for (let i = 0; i < milestones.length; i++) {
        mapping_array.push({ milestone: milestones[i], tokenId: tokens[i] });
      }
      reply.code(200).send(mapping_array);
    } catch (e: any) {
      reply.code(400).send({ status: "error", message: e.message });
    }
  });

  //getStreakRewardContractAddress
  // fastify.get("/api/streak_reward_contract", async (req: FastifyRequest, reply: FastifyReply) => {
  //   try {
  //     let streakRewardContractAddress = await getStreakRewardContractAddress();
  //     reply.code(200).send({ status: "ok", streakRewardContractAddress });
  //   } catch (e: any) {
  //     reply.code(400).send({ status: "error", message: e.message });
  //   }
  // });

  //Just for testing
  fastify.post("/api/mint", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const secret = (req.body as { secret: string }).secret;
      const address = await verify(req, reply);
      if (address && secret === process.env.MINT_SECRET) {
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
      const secret = (req.body as { secret: string }).secret;
      const address = await verify(req, reply);
      if (address && secret === process.env.MINT_SECRET) {
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
