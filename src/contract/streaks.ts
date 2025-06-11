import { ethers, JsonRpcProvider } from "ethers";
import { Address } from "web3";
import dotenv from "dotenv";

dotenv.config();

import contractABI from "../../artifacts/contracts/DailyStreakSystem.sol/DailyStreakSystem.json";
const contractAddress: Address = process.env.DAILYSTREAKSYSTEM_CONTRACT_ADDRESS || "";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";

export async function claimStreakFor(address: Address) {
  console.log("Claiming streak for", address);
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    const txResponse = await contract.claimFor(address);
    return { status: "ok", message: "Streak claimed" };
  } catch (e: any) {
    return { status: "error", message: e.shortMessage };
  }
}

export async function claimHoursAgo(address: Address, hours: number) {
  console.log("Claiming streak for", address);
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    const tx = await contract.claimHoursAgo(address, hours);
    return { status: "ok" };
  } catch (e: any) {
    return { status: "error", message: e.shortMessage };
  }
}

export async function getStreakStatus(address: Address) {
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
  const timeUntilCanClaim = await contract.timeUntilCanClaim(address);
  const timeUntilStreakReset = await contract.timeUntilStreakReset(address);
  const lastClaimed = await contract.lastClaimed(address);
  const streak = await contract.streak(address);
  return { streak: Number(streak), timeUntilCanClaim: Number(timeUntilCanClaim), timeUntilStreakReset: Number(timeUntilStreakReset), lastClaimed: Number(lastClaimed) };
}

export async function getStreakRewardContractAddress() {
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
  const streakRewardContractAddress = await contract.externalERC1155();
  return streakRewardContractAddress;
}

//streak_milestones_to_tokenIds
// export async function getStreakMilestonesToTokensIds() {
//   const provider = new JsonRpcProvider(rpcProvider);
//   const privateKey = process.env.MINTER_PRIVATE_KEY;
//   if (!privateKey) {
//     throw new Error("MINTER_PRIVATE_KEY is not defined");
//   }
//   const wallet = new ethers.Wallet(privateKey, provider);
//   const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
//   const milestones = await contract.getTokenMilestones();
//   return milestones;
// }
