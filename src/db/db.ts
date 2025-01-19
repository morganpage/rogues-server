import { FastifyInstance } from "fastify";
import Web3, { Address, EventLog } from "web3";

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
