"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCooldownContract = resetCooldownContract;
exports.startCooldownFor = startCooldownFor;
exports.startCooldown = startCooldown;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const CooldownSystem_json_1 = __importDefault(require("../../artifacts/contracts/CooldownSystem.sol/CooldownSystem.json"));
const eth_web3auth_1 = require("../utils/eth-web3auth");
const db_1 = require("../db/db");
const telegram_1 = require("../utils/telegram");
const contractAddress = process.env.COOLDOWNSYSTEM_CONTRACT_ADDRESS || "0x11618391Fc9927fAe85C8549C72461e83ac53A1c";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";
async function resetCooldownContract(fastify, tgDataRequest) {
    if (!fastify.mongo || !fastify.mongo.db)
        throw new Error("MongoDB is not configured properly");
    const settings = await (0, db_1.getOutmineSettings)(fastify); //Get outmine_settings->cooldowns_type: 0-no contract,1-use startCooldownFor,2-use startCooldown
    if (!settings)
        return { error: "Outmine settings not found" };
    const cooldowns_type = settings.cooldowns_type;
    const debug = settings.debug;
    if (!cooldowns_type || cooldowns_type == 0)
        return;
    if (debug)
        console.log("resetCooldownContract");
    const req = db_1.TGDataRequest.parse(tgDataRequest);
    const { tg_data, cooldown_id, cooldown_sub_id } = req;
    const cooldownIndex = parseInt(cooldown_sub_id) - 1 < 0 ? 0 : parseInt(cooldown_sub_id) - 1;
    const cooldownFor = cooldowns_type == 1;
    const telegramData = (0, telegram_1.processTelegramDataMultiToken)(tg_data);
    if (telegramData.ok) {
        const user = JSON.parse(telegramData.data.user);
        if (cooldownFor) {
            const user_id = user.id.toString();
            if (!fastify.mongo || !fastify.mongo.db)
                throw new Error("MongoDB is not configured properly");
            const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
            if (!telegram_user || !telegram_user.eth_address) {
                console.log("resetCooldownContract - User not found or eth address not set");
                return false;
            }
            else {
                const address = telegram_user.eth_address;
                if (address) {
                    let cooldown = await startCooldownFor(address, cooldown_id, cooldownIndex);
                    if (debug)
                        console.log(cooldown);
                    if (cooldown.status === "ok") {
                        return true;
                    }
                    else {
                        return false;
                    }
                }
            }
        }
        else {
            const cooldown = await startCooldown(user, cooldown_id, cooldownIndex);
            if (debug)
                console.log(cooldown);
            if (cooldown.status === "ok") {
                return true;
            }
            else {
                return false;
            }
        }
    }
}
async function startCooldownFor(address, cooldownType, cooldownIndex) {
    console.log("Starting cooldown for: ", address);
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, CooldownSystem_json_1.default.abi, wallet);
        //First check if the user is on cooldown
        const isOnCooldownResponse = await isOnCooldown(address, cooldownType, cooldownIndex);
        if (isOnCooldownResponse.status === "ok") {
            const isOnCooldown = isOnCooldownResponse.isOnCooldown;
            if (isOnCooldown) {
                return { status: "error", message: "User is already on cooldown" };
            }
        }
        else {
            return { status: "error", message: isOnCooldownResponse.message };
        }
        const txResponse = await contract.startCooldownFor(address, cooldownType, cooldownIndex);
        await txResponse.wait(); //Wait for transaction to be mined
        return { status: "ok", message: "Cooldown started", txResponse };
    }
    catch (e) {
        return { status: "error", message: e.message };
    }
}
async function startCooldown(user, cooldownType, cooldownIndex) {
    try {
        const JWTtoken = await (0, eth_web3auth_1.generateJwtToken)(user);
        const user_id = user.id.toString();
        const ethData = await (0, eth_web3auth_1.getPrivateKey)(JWTtoken, user_id);
        const eth_address = ethData.ethPublicAddress[0];
        //console.log("Starting cooldown: " + eth_address);
        const privateKey = ethData.ethPrivateKey;
        const provider = new ethers_1.JsonRpcProvider(rpcProvider);
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, CooldownSystem_json_1.default.abi, wallet);
        //First check if the user is on cooldown
        const isOnCooldownResponse = await isOnCooldown(eth_address, cooldownType, cooldownIndex);
        if (isOnCooldownResponse.status === "ok") {
            const isOnCooldown = isOnCooldownResponse.isOnCooldown;
            if (isOnCooldown) {
                return { status: "error", message: "User is already on cooldown" };
            }
        }
        else {
            return { status: "error", message: isOnCooldownResponse.message };
        }
        //Send eth to eth_address from
        await sendEthToAddress(eth_address, "0.000002");
        const txResponse = await contract.startCooldown(cooldownType, cooldownIndex);
        return { status: "ok", message: "Cooldown started", txResponse };
    }
    catch (e) {
        return { status: "error", message: e.message };
    }
}
async function sendEthToAddress(address, amount) {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const txResponse = await wallet.sendTransaction({
            to: address,
            value: ethers_1.ethers.parseUnits(amount, "ether"),
        });
        await txResponse.wait(); //Wait for transaction to be mined
        return { status: "ok", message: "Eth sent", txResponse };
    }
    catch (e) {
        return { status: "error", message: e.message };
    }
}
async function isOnCooldown(address, cooldownType, cooldownIndex) {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const contract = new ethers_1.ethers.Contract(contractAddress, CooldownSystem_json_1.default.abi, provider);
    try {
        const isOnCooldown = await contract.isOnCooldown(cooldownType, address, cooldownIndex);
        return { status: "ok", message: "isOnCooldown", isOnCooldown };
    }
    catch (e) {
        return { status: "error", message: e.message };
    }
}
