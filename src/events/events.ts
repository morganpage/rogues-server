import { FastifyInstance } from "fastify";
import Web3, { Address, EventLog } from "web3";
//import { DailyStreakSystem } from "../contracts/DailyStreakSystem";
import { getLastBlockNumberProcessed, getStreakToPoints, updateLastBlockNumberProcessed, updateUserPoints } from "../db/db";
import dotenv from "dotenv";
import DailyStreakSystem from "../../artifacts/contracts/DailyStreakSystem.sol/DailyStreakSystem.json";

dotenv.config();

const provider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";
const web3 = new Web3(provider);
const abi = DailyStreakSystem.abi;
const contractAddress: Address = process.env.DAILYSTREAKSYSTEM_CONTRACT_ADDRESS || ""; //DailyStreakSystem contract address;
if (contractAddress == "") {
  throw new Error("DAILYSTREAKSYSTEM_CONTRACT_ADDRESS is not defined");
}

const contract = new web3.eth.Contract(abi, contractAddress);

export async function processStreakEvents(fastify: FastifyInstance) {
  console.log("Processing streak events");
  let lastBlockNumber: bigint = await getLastBlockNumberProcessed(fastify, contractAddress);
  while (true) {
    //console.log("Processing events, lastBlock:", lastBlockNumber);
    try {
      const allEvents = await contract.getPastEvents("ALLEVENTS", { filter: {}, fromBlock: lastBlockNumber + 1n, toBlock: "latest" });
      //Filter out the events that are not Claimed
      const claimedEvents = allEvents.filter((e): e is EventLog => typeof e !== "string" && e.event === "Claimed");
      for (let e of claimedEvents) {
        const streak: number = Number(e.returnValues.streak);
        const points: number = await getStreakToPoints(fastify, streak);
        const address: Address = e.returnValues.user as string;
        console.log("User ", address, " claimed streak ", streak, " for ", points, " points");
        if (points > 0) {
          await updateUserPoints(fastify, address, points, `Claimed Streak ${streak}`);
        }
        if (e.blockNumber !== undefined && BigInt(e.blockNumber) > lastBlockNumber) {
          lastBlockNumber = BigInt(e.blockNumber);
        }
      }
      if (claimedEvents.length > 0) {
        console.log(claimedEvents.length, " events processed");
        await updateLastBlockNumberProcessed(fastify, lastBlockNumber, contractAddress);
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error("Error processing streak events", e.message);
      } else {
        console.error("Error processing streak events", e);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10000)); //changed from 5 seconds to 10 seconds
  }
}
