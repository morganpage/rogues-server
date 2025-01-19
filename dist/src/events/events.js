"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processStreakEvents = processStreakEvents;
const web3_1 = __importDefault(require("web3"));
//import { DailyStreakSystem } from "../contracts/DailyStreakSystem";
const db_1 = require("../db/db");
const dotenv_1 = __importDefault(require("dotenv"));
const DailyStreakSystem_json_1 = __importDefault(require("../../artifacts/contracts/DailyStreakSystem.sol/DailyStreakSystem.json"));
dotenv_1.default.config();
const provider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";
const web3 = new web3_1.default(provider);
const abi = DailyStreakSystem_json_1.default.abi;
const contractAddress = process.env.DAILYSTREAKSYSTEM_CONTRACT_ADDRESS || ""; //DailyStreakSystem contract address;
if (contractAddress == "") {
    throw new Error("DAILYSTREAKSYSTEM_CONTRACT_ADDRESS is not defined");
}
const contract = new web3.eth.Contract(abi, contractAddress);
async function processStreakEvents(fastify) {
    let lastBlockNumber = await (0, db_1.getLastBlockNumberProcessed)(fastify, contractAddress);
    while (true) {
        console.log("Processing events, lastBlock:", lastBlockNumber);
        try {
            const allEvents = await contract.getPastEvents("ALLEVENTS", { filter: {}, fromBlock: lastBlockNumber + 1n, toBlock: "latest" });
            //Filter out the events that are not Claimed
            const claimedEvents = allEvents.filter((e) => typeof e !== "string" && e.event === "Claimed");
            for (let e of claimedEvents) {
                const streak = Number(e.returnValues.streak);
                const points = await (0, db_1.getStreakToPoints)(fastify, streak);
                const address = e.returnValues.user;
                console.log("User ", address, " claimed streak ", streak, " for ", points, " points");
                if (points > 0) {
                    await (0, db_1.updateUserPoints)(fastify, address, points, `Claimed Streak ${streak}`);
                }
                if (e.blockNumber !== undefined && BigInt(e.blockNumber) > lastBlockNumber) {
                    lastBlockNumber = BigInt(e.blockNumber);
                }
            }
            if (claimedEvents.length > 0) {
                console.log(claimedEvents.length, " events processed");
                await (0, db_1.updateLastBlockNumberProcessed)(fastify, lastBlockNumber, contractAddress);
            }
        }
        catch (e) {
            console.error("Error processing events", e);
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
}
