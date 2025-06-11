import { ethers, JsonRpcProvider } from "ethers";
import { Address } from "web3";
import dotenv from "dotenv";
import { FastifyInstance } from "fastify";

dotenv.config();

import contractABI from "../../reactive/out/RoguesItems.sol/RoguesItems.json";
const contractAddress: Address = "0x8897167068573d6228Ee8eC62E9DCCEeD193f89F";
const rpcProvider = "https://mainnet-rpc.rnk.dev";
const ipfsGateway = "https://ipfs.sequence.info/ipfs/";

export async function getItemsFromAddress(address: Address) {
  try {
    const provider = new JsonRpcProvider(rpcProvider);
    const contract = new ethers.Contract(contractAddress, contractABI.abi, provider);
    const balances = await contract.balanceOfBatchOneAddr(address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]);
    const nfts: any[] = [];
    //Go through the balances and get the token IDs
    for (let i = 0; i < balances.length; i++) {
      let quantity = balances[i];
      if (quantity > 0) {
        const tokenId = i; // The index corresponds to the token ID
        const uri = await getURIFromTokenId(tokenId);
        const response = await fetch(uri.replace("ipfs://", ipfsGateway)).then((res) => res.json());
        response.image = response.image.replace("ipfs://", ipfsGateway);
        nfts.push({
          tokenId: tokenId,
          quantity: parseInt(quantity.toString()),
          ...response,
        });
      }
    }
    return nfts;
  } catch (e: any) {
    console.error(`Failed to fetch items for address ${address}:`, e);
    return [];
  }
}

async function getURIFromTokenId(tokenId: number) {
  const provider = new JsonRpcProvider(rpcProvider);
  const contract = new ethers.Contract(contractAddress, contractABI.abi, provider);
  const uri = await contract.uri(tokenId);
  return uri;
}
