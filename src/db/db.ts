import { FastifyInstance } from "fastify";
import Web3, { Address } from "web3";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";

export type TelegramGems = {
  user_id: string;
  gems: number;
};

export type EventLog = {
  event_type: string; //started, played, won, lost, purchased etc
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  start_param: string;
  createdAt: Date;
  extraData?: object;
};

export type CooldownsUsers = {
  user_id: string;
  first_name: string;
  last_name: string;
  username: string;
  cooldown_id: string;
  cooldown_sub_id: string;
  cooldown_time: number;
  lastUpdated: Date;
};

export type CooldownExtra = {
  item_id: string;
  quantity: number;
  skill_id: string;
  xp: number;
  mission_id: string;
};

const TGDataRequest = z.object({
  tg_data: z.string(),
  cooldown_id: z.string(),
  cooldown_sub_id: z.string(),
});

export type TGDataRequest = z.infer<typeof TGDataRequest>;

//Cooldowns
export async function resetCooldown(fastify: FastifyInstance, tgDataRequest: TGDataRequest) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  const req = TGDataRequest.parse(tgDataRequest);
  const { tg_data, cooldown_id, cooldown_sub_id } = req;
  const telegramData = processTelegramDataMultiToken(tg_data);
  if (telegramData.ok) {
    // Look up the cooldown in cooldowns
    const cooldowns = await fastify.mongo.db.collection("cooldowns").findOne({ cooldown_id });
    if (!cooldowns) {
      console.log("Cooldown not found", cooldown_id);
      return false; //Cooldown not found, should be set up before in the cooldown table
    }
    const { max_sub_id, cooldown_time, cooldown_extras } = cooldowns;
    //Now check that the cooldown_sub_id is valid, must be less than or equal to the max_sub_id
    if (parseInt(cooldown_sub_id) > max_sub_id) {
      console.log("Invalid cooldown_sub_id", cooldown_sub_id, max_sub_id);
      return false; //Cooldown sub id is invalid
    }

    const { id, username, first_name, last_name } = JSON.parse(telegramData.data.user);
    const user_id: string = id.toString();
    const cooldowns_users = await fastify.mongo.db.collection("cooldowns_users").findOne({ user_id, cooldown_id, cooldown_sub_id });
    if (cooldowns_users) {
      //Cooldown already exists, has it expired?
      const secondsLeft = Math.floor((cooldowns_users.lastUpdated.getTime() + cooldowns_users.cooldown_time * 1000 - new Date().getTime()) / 1000);
      if (secondsLeft > 0) {
        console.log("Cooldown still in effect", secondsLeft);
        return false; //Cooldown is still in effect
      }
      //update the cooldown and return true
      await fastify.mongo.db.collection("cooldowns_users").updateOne({ user_id, cooldown_id, cooldown_sub_id }, { $set: { lastUpdated: new Date(), cooldown_time: cooldown_time } });
      await executeCooldownTask(fastify, cooldown_id, user_id, username, first_name, last_name, cooldown_extras); //Now do the task associated with this cooldown
      return true;
    } else {
      // Cooldown does not exist, create it
      const cooldownsUsers: CooldownsUsers = { user_id, first_name, last_name, username, cooldown_id, cooldown_sub_id, cooldown_time, lastUpdated: new Date() };
      await fastify.mongo.db.collection("cooldowns_users").insertOne(cooldownsUsers);
      await executeCooldownTask(fastify, cooldown_id, user_id, username, first_name, last_name, cooldown_extras); //Now do the task associated with this cooldown
      return true;
    }
  }
  return false;
}

async function executeCooldownTask(fastify: FastifyInstance, cooldown_id: string, user_id: string, username: string, first_name: string, last_name: string, cooldown_extras: CooldownExtra[]) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  //Do the task associated with the cooldown
  //tg_app_center
  if (cooldown_id === "tg_app_center") {
    const gems = 30;
    await updateTelegramGems(fastify, { user_id, gems }); //Add 30 gems
    const eventLog: EventLog = { user_id, event_type: cooldown_id, username, first_name, last_name, start_param: "", createdAt: new Date(), extraData: { gems } };
    await fastify.mongo.db.collection("events").insertOne(eventLog);
  } else {
    if (cooldown_extras && cooldown_extras.length > 0) {
      for (const cooldown_extra of cooldown_extras) {
        const { item_id, quantity, skill_id, xp, mission_id } = cooldown_extra;
        if (item_id) await addItemsUsers(fastify, user_id, item_id, quantity);
        if (skill_id) await addSkillsUsers(fastify, user_id, skill_id, xp);
        if (mission_id) await addMissionsUsers(fastify, user_id, mission_id);
        const eventLog: EventLog = { user_id, event_type: cooldown_id, username, first_name, last_name, start_param: "", createdAt: new Date(), extraData: { item_id, quantity, skill_id, xp } };
        await fastify.mongo.db.collection("events").insertOne(eventLog);
      }
    }
  }
}
//End of cooldowns
//Missions
export async function addMissionsUsers(fastify: FastifyInstance, user_id: string, mission_id: string) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  const mission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id });
  if (mission) {
    const { npc_name } = mission;
    //If there is an existing non-complete mission for this user, don't add another one
    const existingPendingMission = await fastify.mongo.db.collection("rogues_missions_users").findOne({ user_id, mission_id, status: { $ne: "complete" } });
    if (existingPendingMission) return;
    //Add the mission
    await fastify.mongo.db.collection("rogues_missions_users").insertOne({ user_id, mission_id, npc_name, status: "pending" });
  }
}
//Skills- skills_users
export async function addSkillsUsers(fastify: FastifyInstance, user_id: string, skill_id: string, xp: number) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  //Add/amend skills_users
  await fastify.mongo.db.collection("skills_users").updateOne({ user_id, skill_id }, { $inc: { xp } }, { upsert: true });
}
//Inventory - items_users
export async function addItemsUsers(fastify: FastifyInstance, user_id: string, item_id: string, quantity: number) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  if (quantity > 0) {
    //Add/amend user item
    await fastify.mongo.db.collection("items_users").updateOne({ user_id, item_id }, { $inc: { quantity } }, { upsert: true });
  }
}
//Remove items from user inventory
export async function removeItemsUsers(fastify: FastifyInstance, user_id: string, item_id: string, quantity: number) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  //First check that the user has enough of the item
  const itemsUsers = await fastify.mongo.db.collection("items_users").findOne({ user_id, item_id });
  if (itemsUsers && itemsUsers.quantity >= quantity) {
    //Remove the items
    await fastify.mongo.db.collection("items_users").updateOne({ user_id, item_id }, { $inc: { quantity: -quantity } });
    return true;
  }
  return false;
}
export async function hasItemsUsers(fastify: FastifyInstance, user_id: string, item_id: string, quantity: number) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  //First check that the user has enough of the item
  const itemsUsers = await fastify.mongo.db.collection("items_users").findOne({ user_id, item_id });
  if (itemsUsers && itemsUsers.quantity >= quantity) {
    return true;
  }
  return false;
}

//Outmine

async function updateTelegramGems(fastify: FastifyInstance, telegramGems: TelegramGems) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  try {
    //Get existing telegramgems so we can log the change
    const telegramgem = await fastify.mongo.db.collection("telegramgems").updateOne(
      {
        user_id: telegramGems.user_id,
      },
      {
        $inc: { gems: telegramGems.gems },
      },
      { upsert: true }
    );
    return telegramgem;
  } catch (e) {
    console.log(e);
  }
}

// Useful to track the last block number processed when processing events, do this per contract address as we may have multiple contracts
export async function updateLastBlockNumberProcessed(fastify: FastifyInstance, lastBlockNumber: bigint, contractAddress: Address) {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  await fastify.mongo.db.collection("rogues_contracts").updateOne({ contractAddress }, { $set: { lastBlockNumber: lastBlockNumber.toString() } }, { upsert: true });
  return lastBlockNumber;
}

export async function getLastBlockNumberProcessed(fastify: FastifyInstance, contractAddress: Address): Promise<bigint> {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  const contract = await fastify.mongo.db.collection("rogues_contracts").findOne({ contractAddress });
  if (contract) {
    return BigInt(contract.lastBlockNumber);
  }
  return 0n;
}

//rogue_users

export async function updateUserLastLogin(fastify: FastifyInstance, address: Address) {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  const eventName = "User Logged In";
  address = address.toLowerCase();
  //add/amend user last login
  await fastify.mongo.db.collection("rogues_users").updateOne({ address }, { $set: { lastLogin: new Date() } }, { upsert: true });
  //Add a transaction log entry
  await fastify.mongo.db.collection("rogues_transactions").insertOne({ address, eventName, createdAt: new Date() });
}

export async function updateUserPoints(fastify: FastifyInstance, address: Address, points: number, eventName: string) {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  address = address.toLowerCase();
  await fastify.mongo.db.collection("rogues_users").updateOne({ address }, { $inc: { points } }, { upsert: true });
  //Add a transaction log entry
  await fastify.mongo.db.collection("rogues_transactions").insertOne({ address, points, eventName, createdAt: new Date() });
}

//Streak to points
export async function getStreakToPoints(fastify: FastifyInstance, streak: number): Promise<number> {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  //return the top 1 streak to points mapping that is less than or equal to the streak
  const rogues_streaks = await fastify.mongo.db.collection("rogues_streaks").findOne({ streak: { $lte: parseInt(streak as any) } }, { sort: { streak: -1 } });
  if (rogues_streaks) {
    return rogues_streaks.points;
  }
  return 0;
}

//Get all the streak to points mappings - rogues_streaks order by streak asc

export async function getAllStreakToPoints(fastify: FastifyInstance) {
  if (!fastify.mongo || !fastify.mongo.db) {
    throw new Error("MongoDB is not configured properly");
  }
  return fastify.mongo.db.collection("rogues_streaks").find().project({ _id: 0, streak: 1, points: 1 }).sort({ streak: 1 }).toArray();
}
