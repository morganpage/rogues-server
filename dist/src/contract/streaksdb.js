"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreakStatusDB = getStreakStatusDB;
const streaks_1 = require("./streaks");
async function getStreakStatusDB(fastify, address) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    const rogues_user = await fastify.mongo.db.collection("rogues_users").findOne({ address });
    if (rogues_user) {
        //If no lastClaimed field, pull over from Boba contract, this is temporary code
        if (!rogues_user.lastClaimed) {
            //Get streak info from Boba contract if not already in db
            const { lastClaimed, streak } = await (0, streaks_1.getStreakStatus)(address);
            if (lastClaimed && streak && streak > 0) {
                const lastClaimedUTC = new Date(lastClaimed * 1000); // Convert to milliseconds
                await fastify.mongo.db.collection("rogues_users").updateOne({ address }, { $set: { lastClaimed: lastClaimedUTC, streak } });
                rogues_user.lastClaimed = lastClaimedUTC; // Update local variable to reflect the change
                rogues_user.streak = streak; // Update local variable to reflect the change
                console.log("Updated lastClaimed and streak in rogues_users collection for address:", address);
            }
        }
    }
    if (!rogues_user || !rogues_user.lastClaimed) {
        return { streak: Number(0), timeUntilCanClaim: Number(0), timeUntilStreakReset: Number(0), lastClaimed: Number(0) };
    }
    const streakResetTime = 60 * 60 * 24 * 2; // 2 days in seconds
    const streakIncrementTime = 60; // 24 hours in seconds
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - rogues_user.lastClaimed.getTime()) / 1000);
    const timeUntilCanClaim = streakIncrementTime - diffInSeconds > 0 ? streakIncrementTime - diffInSeconds : 0;
    const timeUntilStreakReset = streakResetTime - diffInSeconds > 0 ? streakResetTime - diffInSeconds : 0;
    const streak = rogues_user.streak || 1;
    const lastClaimed = Math.floor(rogues_user.lastClaimed.getTime() / 1000);
    return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}
