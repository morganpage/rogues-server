import { ethers, JsonRpcProvider } from "ethers";
import { Address } from "web3";
import dotenv from "dotenv";
import { FastifyInstance } from "fastify";

dotenv.config();

import contractABI from "../../reactive/out/StreakSystem.sol/StreakSystem.json";
const contractAddress: Address = "0x2eB75a1429F6fE2d60F783c73d656D977AbdfCf9";
const rpcProvider = "https://mainnet-rpc.rnk.dev";
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

export async function syncReactive(fastify: FastifyInstance, address: Address, streakInfoDB: any) {
  try {
    let streakInfoReactive = await getStreakStatusReactive(address);
    console.log("DB Streak:" + streakInfoDB.streak + " Reactive Streak:" + streakInfoReactive.streak);
    if (streakInfoDB.streak - streakInfoReactive.streak !== 1) {
      // Calimimng on reactive wont sync so just set the streak to the db value
      const tx = await setStreakForReactive(address, streakInfoDB.streak);
      return { status: "ok", message: "Streak set on reactive" };
    } else {
      const claimResponse = await claimStreakForReactive(address);
      return { status: "ok", message: "Streak claimed on reactive" };
    }
  } catch (error) {
    console.error("Error in syncReactive:", error);
    return { status: "error", message: "Failed to sync reactive streak" };
  }
}

export async function claimStreakForReactive(address: Address) {
  console.log("Claiming streak for", address);
  const provider = new JsonRpcProvider(rpcProvider);
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    const txResponse = await contract.claimFor(address);
    return { status: "ok", message: "Streak claimed" };
  } catch (e: any) {
    return { status: "error", message: e.shortMessage };
  }
}

export async function getStreakStatusReactive(address: Address) {
  const provider = new JsonRpcProvider(rpcProvider);
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY is not defined");
  }
  const wallet = new ethers.Wallet(adminPrivateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
  const timeUntilCanClaim = await contract.timeUntilCanClaim(address);
  const timeUntilStreakReset = await contract.timeUntilStreakReset(address);
  const lastClaimed = await contract.lastClaimed(address);
  const streak = await contract.streak(address);
  return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}

export async function setStreakForReactive(address: Address, streak: number) {
  console.log("Set streak for", address, "to", streak);
  const provider = new JsonRpcProvider(rpcProvider);
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    const txResponse = await contract.setStreak(address, streak);
    const tx = await contract.claimHoursAgo(address, 0); // Set claim time to now
    return { status: "ok", message: "Streak set" };
  } catch (e: any) {
    return { status: "error", message: e.shortMessage };
  }
}

export async function getStreakMilestonesToTokensIds() {
  const provider = new JsonRpcProvider(rpcProvider);
  if (!adminPrivateKey) {
    throw new Error("ADMIN_PRIVATE_KEY is not defined");
  }
  const wallet = new ethers.Wallet(adminPrivateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
  const milestones = await contract.milestoneToTokenId;
  return milestones;
}
