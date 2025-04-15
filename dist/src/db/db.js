"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TGDataRequest = void 0;
exports.resetCooldown = resetCooldown;
exports.addMissionsUsers = addMissionsUsers;
exports.addSkillsUsers = addSkillsUsers;
exports.addItemsUsers = addItemsUsers;
exports.removeItemsUsers = removeItemsUsers;
exports.hasItemsUsers = hasItemsUsers;
exports.updateLastBlockNumberProcessed = updateLastBlockNumberProcessed;
exports.getLastBlockNumberProcessed = getLastBlockNumberProcessed;
exports.updateUserLastLogin = updateUserLastLogin;
exports.updateUserPoints = updateUserPoints;
exports.getStreakToPoints = getStreakToPoints;
exports.getAllStreakToPoints = getAllStreakToPoints;
exports.getOutmineSettings = getOutmineSettings;
const zod_1 = require("zod");
const telegram_1 = require("../utils/telegram");
exports.TGDataRequest = zod_1.z.object({
    tg_data: zod_1.z.string(),
    cooldown_id: zod_1.z.string(),
    cooldown_sub_id: zod_1.z.string(),
});
//Cooldowns
async function resetCooldown(fastify, tgDataRequest) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    const req = exports.TGDataRequest.parse(tgDataRequest);
    const { tg_data, cooldown_id, cooldown_sub_id } = req;
    const telegramData = (0, telegram_1.processTelegramDataMultiToken)(tg_data);
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
        const user_id = id.toString();
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
        }
        else {
            // Cooldown does not exist, create it
            const cooldownsUsers = { user_id, first_name, last_name, username, cooldown_id, cooldown_sub_id, cooldown_time, lastUpdated: new Date() };
            await fastify.mongo.db.collection("cooldowns_users").insertOne(cooldownsUsers);
            await executeCooldownTask(fastify, cooldown_id, user_id, username, first_name, last_name, cooldown_extras); //Now do the task associated with this cooldown
            return true;
        }
    }
    return false;
}
async function executeCooldownTask(fastify, cooldown_id, user_id, username, first_name, last_name, cooldown_extras) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    //Do the task associated with the cooldown
    //tg_app_center
    if (cooldown_id === "tg_wor") {
        const gems = 40;
        await updateTelegramGems(fastify, { user_id, gems }); //Add 30 gems
        const eventLog = { user_id, event_type: cooldown_id, username, first_name, last_name, start_param: "", createdAt: new Date(), extraData: { gems } };
        await fastify.mongo.db.collection("events").insertOne(eventLog);
    }
    else {
        if (cooldown_extras && cooldown_extras.length > 0) {
            for (const cooldown_extra of cooldown_extras) {
                const { item_id, quantity, skill_id, xp, mission_id } = cooldown_extra;
                if (item_id)
                    await addItemsUsers(fastify, user_id, item_id, quantity);
                if (skill_id)
                    await addSkillsUsers(fastify, user_id, skill_id, xp);
                if (mission_id)
                    await addMissionsUsers(fastify, user_id, mission_id);
                const eventLog = { user_id, event_type: cooldown_id, username, first_name, last_name, start_param: "", createdAt: new Date(), extraData: { item_id, quantity, skill_id, xp } };
                await fastify.mongo.db.collection("events").insertOne(eventLog);
            }
        }
    }
}
//End of cooldowns
//Missions
async function addMissionsUsers(fastify, user_id, mission_id) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    const mission = await fastify.mongo.db.collection("rogues_missions").findOne({ mission_id });
    if (mission) {
        const { npc_name } = mission;
        //If there is an existing non-complete mission for this user, don't add another one
        const existingPendingMission = await fastify.mongo.db.collection("rogues_missions_users").findOne({ user_id, mission_id, status: { $ne: "complete" } });
        if (existingPendingMission)
            return;
        //Add the mission
        await fastify.mongo.db.collection("rogues_missions_users").insertOne({ user_id, mission_id, npc_name, status: "pending" });
    }
}
//Skills- skills_users
async function addSkillsUsers(fastify, user_id, skill_id, xp) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    //Add/amend skills_users
    await fastify.mongo.db.collection("skills_users").updateOne({ user_id, skill_id }, { $inc: { xp } }, { upsert: true });
}
//Inventory - items_users
async function addItemsUsers(fastify, user_id, item_id, quantity) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    if (quantity > 0) {
        //Add/amend user item
        await fastify.mongo.db.collection("items_users").updateOne({ user_id, item_id }, { $inc: { quantity } }, { upsert: true });
    }
}
//Remove items from user inventory
async function removeItemsUsers(fastify, user_id, item_id, quantity) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    //First check that the user has enough of the item
    const itemsUsers = await fastify.mongo.db.collection("items_users").findOne({ user_id, item_id });
    if (itemsUsers && itemsUsers.quantity >= quantity) {
        //Remove the items
        await fastify.mongo.db.collection("items_users").updateOne({ user_id, item_id }, { $inc: { quantity: -quantity } });
        return true;
    }
    return false;
}
async function hasItemsUsers(fastify, user_id, item_id, quantity) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    //First check that the user has enough of the item
    const itemsUsers = await fastify.mongo.db.collection("items_users").findOne({ user_id, item_id });
    if (itemsUsers && itemsUsers.quantity >= quantity) {
        return true;
    }
    return false;
}
//Outmine
async function updateTelegramGems(fastify, telegramGems) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    try {
        //Get existing telegramgems so we can log the change
        const telegramgem = await fastify.mongo.db.collection("telegramgems").updateOne({
            user_id: telegramGems.user_id,
        }, {
            $inc: { gems: telegramGems.gems },
        }, { upsert: true });
        return telegramgem;
    }
    catch (e) {
        console.log(e);
    }
}
// Useful to track the last block number processed when processing events, do this per contract address as we may have multiple contracts
async function updateLastBlockNumberProcessed(fastify, lastBlockNumber, contractAddress) {
    if (!fastify.mongo || !fastify.mongo.db) {
        throw new Error("MongoDB is not configured properly");
    }
    await fastify.mongo.db.collection("rogues_contracts").updateOne({ contractAddress }, { $set: { lastBlockNumber: lastBlockNumber.toString() } }, { upsert: true });
    return lastBlockNumber;
}
async function getLastBlockNumberProcessed(fastify, contractAddress) {
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
async function updateUserLastLogin(fastify, address) {
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
async function updateUserPoints(fastify, address, points, eventName) {
    if (!fastify.mongo || !fastify.mongo.db) {
        throw new Error("MongoDB is not configured properly");
    }
    address = address.toLowerCase();
    await fastify.mongo.db.collection("rogues_users").updateOne({ address }, { $inc: { points } }, { upsert: true });
    //Add a transaction log entry
    await fastify.mongo.db.collection("rogues_transactions").insertOne({ address, points, eventName, createdAt: new Date() });
}
//Streak to points
async function getStreakToPoints(fastify, streak) {
    if (!fastify.mongo || !fastify.mongo.db) {
        throw new Error("MongoDB is not configured properly");
    }
    //return the top 1 streak to points mapping that is less than or equal to the streak
    const rogues_streaks = await fastify.mongo.db.collection("rogues_streaks").findOne({ streak: { $lte: parseInt(streak) } }, { sort: { streak: -1 } });
    if (rogues_streaks) {
        return rogues_streaks.points;
    }
    return 0;
}
//Get all the streak to points mappings - rogues_streaks order by streak asc
async function getAllStreakToPoints(fastify) {
    if (!fastify.mongo || !fastify.mongo.db) {
        throw new Error("MongoDB is not configured properly");
    }
    return fastify.mongo.db.collection("rogues_streaks").find().project({ _id: 0, streak: 1, points: 1 }).sort({ streak: 1 }).toArray();
}
//Get first record from outmine_settings collection
async function getOutmineSettings(fastify) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    const settings = await fastify.mongo.db.collection("outmine_settings").findOne();
    return settings;
}
