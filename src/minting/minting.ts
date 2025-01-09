import { ethers, JsonRpcProvider } from "ethers";
import { RoguesItems } from "../contracts/RoguesItems";
import { Address } from "web3";
import dotenv from "dotenv";

dotenv.config();

const contractABI = RoguesItems.abi;
const contractAddress: Address = process.env.ROGUESITEMS_CONTRACT_ADDRESS || "";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";

export async function mintGameItemToAddress(address: Address, itemID: number, quantity: number) {
  console.log("Minting");
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  const tx = await contract.mint(address, itemID, quantity, "0x");
  console.log("Mint TX:", tx.hash);
  await tx.wait();
  console.log("Minted");
}
