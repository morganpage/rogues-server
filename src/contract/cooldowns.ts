import { ethers, JsonRpcProvider } from "ethers";
import { Address, eth } from "web3";
import dotenv from "dotenv";
import { FastifyInstance } from "fastify";

dotenv.config();

import contractABI from "../../artifacts/contracts/CooldownSystem.sol/CooldownSystem.json";
import { generateJwtToken, getPrivateKey } from "../utils/eth-web3auth";
import { getOutmineSettings, TGDataRequest } from "../db/db";
import { processTelegramDataMultiToken } from "../utils/telegram";
const contractAddress: Address = process.env.COOLDOWNSYSTEM_CONTRACT_ADDRESS || "0x11618391Fc9927fAe85C8549C72461e83ac53A1c";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";

export async function resetCooldownContract(fastify: FastifyInstance, tgDataRequest: TGDataRequest) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  const settings = await getOutmineSettings(fastify); //Get outmine_settings->cooldowns_type: 0-no contract,1-use startCooldownFor,2-use startCooldown
  if (!settings) return { error: "Outmine settings not found" };
  const cooldowns_type = settings.cooldowns_type;
  const debug = settings.debug;
  if (!cooldowns_type || cooldowns_type == 0) return;
  if (debug) console.log("resetCooldownContract");
  const req = TGDataRequest.parse(tgDataRequest);
  const { tg_data, cooldown_id, cooldown_sub_id } = req;
  const cooldownIndex = parseInt(cooldown_sub_id) - 1 < 0 ? 0 : parseInt(cooldown_sub_id) - 1;
  const cooldownFor = cooldowns_type == 1;
  const telegramData = processTelegramDataMultiToken(tg_data);
  if (telegramData.ok) {
    const user = JSON.parse(telegramData.data.user);
    if (cooldownFor) {
      const user_id = user.id.toString();
      if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
      const telegram_user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
      if (!telegram_user || !telegram_user.eth_address) {
        console.log("resetCooldownContract - User not found or eth address not set");
        return false;
      } else {
        const address = telegram_user.eth_address;
        if (address) {
          let cooldown = await startCooldownFor(address, cooldown_id, cooldownIndex);
          if (debug) console.log(cooldown);
          if (cooldown.status === "ok") {
            return true;
          } else {
            return false;
          }
        }
      }
    } else {
      const cooldown = await startCooldown(user, cooldown_id, cooldownIndex);
      if (debug) console.log(cooldown);
      if (cooldown.status === "ok") {
        return true;
      } else {
        return false;
      }
    }
  }
}

export async function startCooldownFor(address: Address, cooldownType: string, cooldownIndex: number) {
  console.log("Starting cooldown for: ", address);
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    //First check if the user is on cooldown
    const isOnCooldownResponse = await isOnCooldown(address, cooldownType, cooldownIndex);
    if (isOnCooldownResponse.status === "ok") {
      const isOnCooldown = isOnCooldownResponse.isOnCooldown;
      if (isOnCooldown) {
        return { status: "error", message: "User is already on cooldown" };
      }
    } else {
      return { status: "error", message: isOnCooldownResponse.message };
    }
    const txResponse = await contract.startCooldownFor(address, cooldownType, cooldownIndex);
    await txResponse.wait(); //Wait for transaction to be mined
    return { status: "ok", message: "Cooldown started", txResponse };
  } catch (e: any) {
    return { status: "error", message: e.message };
  }
}

export async function startCooldown(user: any, cooldownType: string, cooldownIndex: number) {
  try {
    const JWTtoken = await generateJwtToken(user);
    const user_id = user.id.toString();
    const ethData = await getPrivateKey(JWTtoken, user_id);
    const eth_address = (ethData as { ethPublicAddress: string[] }).ethPublicAddress[0];
    //console.log("Starting cooldown: " + eth_address);
    const privateKey = ethData.ethPrivateKey as string;
    const provider = new JsonRpcProvider(rpcProvider);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    //First check if the user is on cooldown
    const isOnCooldownResponse = await isOnCooldown(eth_address, cooldownType, cooldownIndex);
    if (isOnCooldownResponse.status === "ok") {
      const isOnCooldown = isOnCooldownResponse.isOnCooldown;
      if (isOnCooldown) {
        return { status: "error", message: "User is already on cooldown" };
      }
    } else {
      return { status: "error", message: isOnCooldownResponse.message };
    }
    //Send eth to eth_address from
    await sendEthToAddress(eth_address, "0.000002");
    const txResponse = await contract.startCooldown(cooldownType, cooldownIndex);
    return { status: "ok", message: "Cooldown started", txResponse };
  } catch (e: any) {
    return { status: "error", message: e.message };
  }
}

async function sendEthToAddress(address: Address, amount: string) {
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const txResponse = await wallet.sendTransaction({
      to: address,
      value: ethers.parseUnits(amount, "ether"),
    });
    await txResponse.wait(); //Wait for transaction to be mined
    return { status: "ok", message: "Eth sent", txResponse };
  } catch (e: any) {
    return { status: "error", message: e.message };
  }
}

async function isOnCooldown(address: Address, cooldownType: string, cooldownIndex: number) {
  const provider = new JsonRpcProvider(rpcProvider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, provider);
  try {
    const isOnCooldown = await contract.isOnCooldown(cooldownType, address, cooldownIndex);
    return { status: "ok", message: "isOnCooldown", isOnCooldown };
  } catch (e: any) {
    return { status: "error", message: e.message };
  }
}
