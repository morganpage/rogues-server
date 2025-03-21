import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";
import { addItemsUsers, removeItemsUsers, hasItemsUsers } from "../db/db";

const tgDataRequest = z.object({
  tg_data: z.string(),
  mission_id: z.string(),
});

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/api/rogues_missions/:mission_id", async (request: any, reply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const mission_id = request.params.mission_id;
    const task = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id });
    reply.code(200).send(task);
  });

  fastify.get("/api/rogues_missions_users/:user_id", async (request: any, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const { user_id } = request.params;
    const missionsUsers = await fastify.mongo.db.collection("rogues_missions_users").find({ user_id }).toArray();
    if (missionsUsers.length === 0) {
      //If no missions, add the tutorial mission
      const tutorialMission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id: "tutorial" });
      if (tutorialMission) {
        const { mission_id, npc_name } = tutorialMission;
        await fastify.mongo.db.collection("rogues_missions_users").insertOne({ user_id, mission_id, npc_name, status: "pending" });
        reply.code(200).send([{ user_id, mission_id, npc_name, status: "pending" }]);
      }
      // const tutorialMission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id: "tutorial" });
      // if (tutorialMission) {
      //   const { mission_id, npc_name } = tutorialMission;
      //   reply.code(200).send([{ user_id, mission_id, npc_name, status: "pending" }]);
      // }
    }
    //Now filter out all records with status completed
    const filteredMissionsUsers = missionsUsers.filter((missionUser) => missionUser.status !== "completed");
    reply.code(200).send(filteredMissionsUsers);
  });

  //function to accept a mission which can also add a new mission to a mission_user
  fastify.post("/api/rogues_missions_users", async (request: any, reply: FastifyReply) => {
    try {
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      if (telegramData.ok) {
        const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
        const user_id = id.toString();
        const { mission_id } = req;
        const mission_user = await updateMissionToMissionUser(fastify, user_id, mission_id);
        reply.code(200).send(mission_user);
      }
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });

  async function doStatusUpdates(fastify: FastifyInstance, user_id: string, status: any) {
    //console.log("doStatusUpdates", user_id, status);
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    const { add_missions, add_items, remove_items, has_items, not_items } = status;
    if (not_items) {
      for (const not_item of not_items) {
        const { item_id } = not_item;
        const hasItem = await hasItemsUsers(fastify, user_id, item_id, 1);
        if (hasItem) return false;
      }
    }
    if (remove_items) {
      for (const remove_item of remove_items) {
        const { item_id, quantity } = remove_item;
        const hasItem = await hasItemsUsers(fastify, user_id, item_id, quantity);
        if (!hasItem) return false;
      }
      for (const remove_item of remove_items) {
        const { item_id, quantity } = remove_item;
        await removeItemsUsers(fastify, user_id, item_id, quantity);
      }
    }
    if (has_items) {
      for (const has_item of has_items) {
        const { item_id, quantity } = has_item;
        const hasItem = await hasItemsUsers(fastify, user_id, item_id, quantity);
        if (!hasItem) return false;
      }
    }
    if (add_missions) {
      for (const add_mission of add_missions) {
        const mission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id: add_mission });
        if (mission) {
          const { npc_name } = mission;
          await fastify.mongo.db.collection("rogues_missions_users").insertOne({ user_id, mission_id: add_mission, npc_name, status: "pending" });
        }
      }
    }
    if (add_items) {
      for (const add_item of add_items) {
        console.log("ADDING ITEM", add_item);
        const { item_id, quantity } = add_item;
        await addItemsUsers(fastify, user_id, item_id, quantity);
      }
    }
    return true;
  }

  async function updateMissionToMissionUser(fastify: FastifyInstance, user_id: string, mission_id: string) {
    if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    //Look up the mission
    const mission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id }); //mission should exist!
    if (!mission) {
      throw new Error("Mission not found");
    }
    //See if there is already a mission_user that has not been completed: can have multiple dailies, never touch completed missions
    const existingMissionUser = await fastify.mongo.db.collection("rogues_missions_users").findOne({ user_id, mission_id, status: { $ne: "completed" } });
    if (existingMissionUser) {
      //Update the status
      const { _id, status } = existingMissionUser;
      console.log("_id:" + _id + "user_id:" + user_id + " mission_id:" + mission_id + " status:" + status);
      let statusUpdates = false;
      switch (status) {
        case "pending":
          statusUpdates = await doStatusUpdates(fastify, user_id, mission.pending);
          if (!statusUpdates) return existingMissionUser;
          //Some missions complete immediately after pending, ie the end of Love Letter, they are missing mission.accepted
          if (!mission.accepted) {
            await fastify.mongo.db.collection("rogues_missions_users").updateOne({ _id }, { $set: { status: "completed" } });
            break;
          }
          await fastify.mongo.db.collection("rogues_missions_users").updateOne({ _id }, { $set: { status: "accepted" } });
          break;
        case "accepted":
          statusUpdates = await doStatusUpdates(fastify, user_id, mission.accepted);
          if (!statusUpdates) return existingMissionUser;
          await fastify.mongo.db.collection("rogues_missions_users").updateOne({ _id }, { $set: { status: "completed" } });
          break;
        default:
          //Do nothing
          return existingMissionUser;
      }
    }
    const mission_user = await fastify.mongo.db.collection("rogues_missions_users").findOne({ user_id, mission_id });
    return mission_user;
  }
} // end of routes function

export default routes;
