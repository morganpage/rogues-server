import { Address } from "web3";
import { FastifyInstance } from "fastify";
import { getStreakStatus } from "./streaks";
import { getOutmineSettings } from "../db/db";

export async function getStreakStatusDB(fastify: FastifyInstance, address: Address) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  const rogues_user = await fastify.mongo.db.collection("rogues_users").findOne({ address });
  if (rogues_user) {
    //If no lastClaimed field, pull over from Boba contract, this is temporary code
    if (!rogues_user.lastClaimed) {
      //Get streak info from Boba contract if not already in db, remove this line after a few weeks
      const { lastClaimed, streak } = await getStreakStatus(address);
      if (lastClaimed && streak && streak > 0) {
        const lastClaimedUTC = new Date(lastClaimed * 1000); // Convert to milliseconds
        await fastify.mongo.db.collection("rogues_users").updateOne({ address }, { $set: { lastClaimed: lastClaimedUTC, streak } });
        rogues_user.lastClaimed = lastClaimedUTC; // Update local variable to reflect the change
        rogues_user.streak = streak; // Update local variable to reflect the change
        console.log("Updated lastClaimed and streak in rogues_users collection for address:", address);
      }
    }
  }
  const settings = await getOutmineSettings(fastify);
  if (!settings) return { error: "Outmine settings not found" };
  const { debug, streak_increment_time, streak_reset_time } = settings;

  if (!rogues_user || !rogues_user.lastClaimed || !streak_increment_time || !streak_reset_time) {
    return { streak: Number(0), timeUntilCanClaim: Number(0), timeUntilStreakReset: Number(0), lastClaimed: Number(0) };
  }
  if (debug) console.log("getStreakStatusDB - address:", address, "lastClaimed:", rogues_user.lastClaimed, "streak:", rogues_user.streak);
  // const streakResetTime = 60 * 60 * 24 * 2; // 2 days in seconds
  // const streakIncrementTime = 60 * 60 * 24 * 1; // 24 hours in seconds
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - rogues_user.lastClaimed.getTime()) / 1000);
  const timeUntilCanClaim = streak_increment_time - diffInSeconds > 0 ? streak_increment_time - diffInSeconds : 0;
  const timeUntilStreakReset = streak_reset_time - diffInSeconds > 0 ? streak_reset_time - diffInSeconds : 0;
  const streak = rogues_user.streak || 1;
  const lastClaimed = Math.floor(rogues_user.lastClaimed.getTime() / 1000);
  return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}
