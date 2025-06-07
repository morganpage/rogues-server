"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimStreakFor = claimStreakFor;
exports.claimHoursAgo = claimHoursAgo;
exports.getStreakStatus = getStreakStatus;
exports.getStreakRewardContractAddress = getStreakRewardContractAddress;
exports.getStreakMilestonesToTokensIds = getStreakMilestonesToTokensIds;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DailyStreakSystem_json_1 = __importDefault(require("../../artifacts/contracts/DailyStreakSystem.sol/DailyStreakSystem.json"));
const contractAddress = process.env.DAILYSTREAKSYSTEM_CONTRACT_ADDRESS || "";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";
async function claimStreakFor(address) {
    console.log("Claiming streak for", address);
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, DailyStreakSystem_json_1.default.abi, wallet);
        const txResponse = await contract.claimFor(address);
        return { status: "ok", message: "Streak claimed" };
    }
    catch (e) {
        return { status: "error", message: e.shortMessage };
    }
}
async function claimHoursAgo(address, hours) {
    console.log("Claiming streak for", address);
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, DailyStreakSystem_json_1.default.abi, wallet);
        const tx = await contract.claimHoursAgo(address, hours);
        return { status: "ok" };
    }
    catch (e) {
        return { status: "error", message: e.shortMessage };
    }
}
async function getStreakStatus(address) {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
    const contract = new ethers_1.ethers.Contract(contractAddress, DailyStreakSystem_json_1.default.abi, wallet);
    const timeUntilCanClaim = await contract.timeUntilCanClaim(address);
    const timeUntilStreakReset = await contract.timeUntilStreakReset(address);
    const lastClaimed = await contract.lastClaimed(address);
    const streak = await contract.streak(address);
    return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}
async function getStreakRewardContractAddress() {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
    const contract = new ethers_1.ethers.Contract(contractAddress, DailyStreakSystem_json_1.default.abi, wallet);
    const streakRewardContractAddress = await contract.externalERC1155();
    return streakRewardContractAddress;
}
//streak_milestones_to_tokenIds
async function getStreakMilestonesToTokensIds() {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
    const contract = new ethers_1.ethers.Contract(contractAddress, DailyStreakSystem_json_1.default.abi, wallet);
    const milestones = await contract.getTokenMilestones();
    return milestones;
}
