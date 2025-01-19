"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLastBlockNumberProcessed = updateLastBlockNumberProcessed;
exports.getLastBlockNumberProcessed = getLastBlockNumberProcessed;
exports.updateUserLastLogin = updateUserLastLogin;
exports.updateUserPoints = updateUserPoints;
exports.getStreakToPoints = getStreakToPoints;
exports.getAllStreakToPoints = getAllStreakToPoints;
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
