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
    const txReceipt = await txResponse.wait();
    console.log(txReceipt);
    // const txReceipt = await txResponse.wait();
    // const streak = (txReceipt?.logs?.[0] as any).args[1]; //Pull the streak from the event
    // const tokenId = (txReceipt?.logs?.[0] as any).args[2]; //Pull the tokenId from the event
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
