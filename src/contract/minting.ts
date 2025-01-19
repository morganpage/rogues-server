import { ethers, JsonRpcProvider } from "ethers";
import { Address } from "web3";
import dotenv from "dotenv";

dotenv.config();

import contractABI from "../../artifacts/contracts/RoguesItems.sol/RoguesItems.json";
const contractAddress: Address = process.env.ROGUESITEMS_CONTRACT_ADDRESS || "";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";

export async function mintGameItemToAddress(address: Address, itemID: number, quantity: number) {
  console.log("Minting");
  const provider = new JsonRpcProvider(rpcProvider);
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("MINTER_PRIVATE_KEY is not defined");
  }
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, wallet);
    const tx = await contract.mint(address, itemID, quantity, "0x");
    console.log("Mint TX:", tx.hash);
    await tx.wait();
    return { status: "ok", message: "Minted" };
  } catch (e: any) {
    return { status: "error", message: e.shortMessage };
  }
}

export async function getURIFromTokenId(tokenId: number) {
  const provider = new JsonRpcProvider(rpcProvider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, provider);
  const uri = await contract.uri(tokenId);
  return uri;
}
