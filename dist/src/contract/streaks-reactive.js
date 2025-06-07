"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncReactive = syncReactive;
exports.claimStreakForReactive = claimStreakForReactive;
exports.getStreakStatusReactive = getStreakStatusReactive;
exports.setStreakForReactive = setStreakForReactive;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const StreakSystem_json_1 = __importDefault(require("../../reactive/out/StreakSystem.sol/StreakSystem.json"));
const contractAddress = process.env.STREAKSYSTEM_CONTRACT_ADDRESS || "";
const rpcProvider = "https://kopli-rpc.rnk.dev";
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
async function syncReactive(fastify, address, streakInfoDB) {
    try {
        let streakInfoReactive = await getStreakStatusReactive(address);
        console.log("DB Streak:" + streakInfoDB.streak + " Reactive Streak:" + streakInfoReactive.streak);
        if (streakInfoDB.streak - streakInfoReactive.streak !== 1) {
            // Calimimng on reactive wont sync so just set the streak to the db value
            const tx = await setStreakForReactive(address, streakInfoDB.streak);
            return { status: "ok", message: "Streak set on reactive" };
        }
        else {
            const claimResponse = await claimStreakForReactive(address);
            return { status: "ok", message: "Streak claimed on reactive" };
        }
    }
    catch (error) {
        console.error("Error in syncReactive:", error);
        return { status: "error", message: "Failed to sync reactive streak" };
    }
}
async function claimStreakForReactive(address) {
    console.log("Claiming streak for", address);
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(adminPrivateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, StreakSystem_json_1.default.abi, wallet);
        const txResponse = await contract.claimFor(address);
        return { status: "ok", message: "Streak claimed" };
    }
    catch (e) {
        return { status: "error", message: e.shortMessage };
    }
}
async function getStreakStatusReactive(address) {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY is not defined");
    }
    const wallet = new ethers_1.ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers_1.ethers.Contract(contractAddress, StreakSystem_json_1.default.abi, wallet);
    const timeUntilCanClaim = await contract.timeUntilCanClaim(address);
    const timeUntilStreakReset = await contract.timeUntilStreakReset(address);
    const lastClaimed = await contract.lastClaimed(address);
    const streak = await contract.streak(address);
    return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}
async function setStreakForReactive(address, streak) {
    console.log("Set streak for", address, "to", streak);
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    if (!adminPrivateKey) {
        throw new Error("ADMIN_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(adminPrivateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, StreakSystem_json_1.default.abi, wallet);
        const txResponse = await contract.setStreak(address, streak);
        const tx = await contract.claimHoursAgo(address, 0); // Set claim time to now
        return { status: "ok", message: "Streak set" };
    }
    catch (e) {
        return { status: "error", message: e.shortMessage };
    }
}
