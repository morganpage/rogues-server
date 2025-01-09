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

//Update user points in the DB
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
  const rogues_streaks = await fastify.mongo.db.collection("rogues_streaks").findOne({ streak });
  if (rogues_streaks) {
    return rogues_streaks.points;
  }
  return 0;
}
