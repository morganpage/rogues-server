import { FastifyInstance } from "fastify";
import Web3, { Address, EventLog } from "web3";
import dotenv from "dotenv";
import contractABI from "../../polygon/out/GamePayment.sol/GamePayment.json";
import { processGamePaymentEvent } from "../db/db";

dotenv.config();

const provider = "https://polygon-rpc.com";
const web3 = new Web3(provider);
const abi = contractABI.abi;
const contractAddress: Address = process.env.GAME_PAYMENT_CONTRACT_ADDRESS_POLYGON || ""; //GamePayment contract address;
if (contractAddress == "") {
  throw new Error("GAME_PAYMENT_CONTRACT_ADDRESS_POLYGON is not defined");
}

const contract = new web3.eth.Contract(abi, contractAddress);

console.log("Using Polygon GamePayment contract at address:", contractAddress);

const fnLastProcessedBlockNumber = async (fastify: FastifyInstance): Promise<bigint> => {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  // Get the last block we processed from MongoDB
  const lastTransaction = await fastify.mongo?.db.collection("eth_payment_transactions").findOne({ contract_address: contractAddress }, { sort: { timestamp: -1 } });
  let lastBlockNumberProcessed: bigint = lastTransaction ? BigInt(lastTransaction.block_number) : 0n;
  // If last block number is not found, start from the latest block
  if (lastBlockNumberProcessed === 0n) {
    lastBlockNumberProcessed = BigInt(await web3.eth.getBlockNumber());
    console.log("No previous transactions found, starting from latest block:", lastBlockNumberProcessed);
  } else {
    console.log("Last processed block number:", lastBlockNumberProcessed);
  }
  return lastBlockNumberProcessed;
};

export async function processPolygonGamePaymentEvents(fastify: FastifyInstance) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  console.log("Processing Polygon Game Payment events for contract:", contractAddress);
  const BATCH_SIZE = 64n;
  let lastBlockNumberProcessed: bigint = await fnLastProcessedBlockNumber(fastify);
  console.log("Starting from block number:", lastBlockNumberProcessed);
  while (true) {
    try {
      const latestBlock = BigInt(await web3.eth.getBlockNumber());
      //console.log("Latest block number:", latestBlock);

      while (lastBlockNumberProcessed < latestBlock) {
        const fromBlock = lastBlockNumberProcessed + 1n;
        const toBlock = fromBlock + BATCH_SIZE - 1n > latestBlock ? latestBlock : fromBlock + BATCH_SIZE - 1n;
        //console.log(`Fetching events from block ${fromBlock} to ${toBlock}`);
        const allEvents = await contract.getPastEvents("ALLEVENTS", {
          filter: {},
          fromBlock: Number(fromBlock),
          toBlock: Number(toBlock),
        });
        const paymentReceivedEvents = allEvents.filter((e): e is EventLog => typeof e !== "string" && e.event === "PaymentReceived");
        for (let e of paymentReceivedEvents) {
          const returnValues = e.returnValues as { itemId: string; userId: string; amount: bigint; payer: string };
          const itemId: string = returnValues.itemId;
          const userId: string = returnValues.userId;
          const amount: bigint = BigInt(returnValues.amount); // Ensure it's BigInt
          const payer: Address = returnValues.payer;
          const blockNumber = e.blockNumber ? BigInt(e.blockNumber) : lastBlockNumberProcessed;
          const amountInUSDC: number = parseFloat(web3.utils.fromWei(amount.toString(), "mwei"));
          console.log(`Payer ${payer} purchased item ${itemId} for ${amountInUSDC} USDC (userId: ${userId})`);
          //console.log(returnValues);
          await processGamePaymentEvent(fastify, payer, itemId, userId, amountInUSDC, blockNumber, "USDC", contractAddress);
        }
        if (paymentReceivedEvents.length > 0) {
          console.log(`${paymentReceivedEvents.length} events processed`);
        }
        lastBlockNumberProcessed = toBlock;
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error("Error processing game payment events:", e.message);
      } else {
        console.error("Unknown error processing game payment events:", e);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds before polling again
  }
}
