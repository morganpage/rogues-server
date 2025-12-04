import { FastifyInstance } from "fastify";
import Web3, { Address, EventLog } from "web3";
import dotenv from "dotenv";
import contractABI from "../../moonbeam/out/GamePayment.sol/GamePayment.json";
import { buyCoins } from "../db/db";

dotenv.config();

const provider = "https://rpc.api.moonbeam.network";
const web3 = new Web3(provider);
const abi = contractABI.abi;
const contractAddress: Address = process.env.GAME_PAYMENT_CONTRACT_ADDRESS_MOONBEAM || ""; //GamePayment contract address;
if (contractAddress == "") {
  throw new Error("GAME_PAYMENT_CONTRACT_ADDRESS_MOONBEAM is not defined");
}

const contract = new web3.eth.Contract(abi, contractAddress);

async function processGamePaymentEvent(fastify: FastifyInstance, sender: Address, product_id: string, user_id: string, amount: number, blockNumber: bigint) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  const timestamp = new Date().toISOString();
  const block_number = blockNumber.toString();
  const user = await fastify.mongo.db.collection("telegram_users").findOne({ user_id });
  const coin_product = await fastify.mongo.db.collection("coin_products").findOne({ product_id });
  if (!user || !coin_product) {
    console.error("Invalid user or product");
    await fastify.mongo.db.collection("eth_payment_transactions").insertOne({ user_id, product_id, amount, sender, timestamp, block_number, success: false, message: "Invalid user or product" });
    return; // Skip if user or product is not valid
  }
  const username = user.username || user.first_name || "Unknown User";
  const buyCoinsResponse = await buyCoins(fastify, user_id, product_id, amount, "GLMR", username);
  const transaction = {
    user_id,
    product_id,
    username,
    amount,
    currency: "GLMR",
    sender,
    timestamp,
    block_number,
    contract_address: contractAddress,
    success: buyCoinsResponse.ok,
    message: buyCoinsResponse.error || buyCoinsResponse.message,
  };
  await fastify.mongo.db.collection("eth_payment_transactions").insertOne(transaction);
  console.log(`Processed payment event for ${sender} purchasing item ${product_id} for ${amount} GLMR (userId: ${user_id})`);
}

export async function processGamePaymentEvents(fastify: FastifyInstance) {
  if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
  console.log("Processing Game Payment events for contract:", contractAddress);
  const BATCH_SIZE = 1024n;
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
  while (true) {
    const outmineSettings = await fastify.mongo.db.collection("outmine_settings").findOne({});

    if (!outmineSettings || !outmineSettings.moonbeam_game_payments_enabled) {
      console.log("Moonbeam game payments processing is disabled in outmine_settings. Waiting...");
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds before checking again
      continue;
    }

    try {
      const latestBlock = BigInt(await web3.eth.getBlockNumber());

      while (lastBlockNumberProcessed < latestBlock) {
        const fromBlock = lastBlockNumberProcessed + 1n;
        const toBlock = fromBlock + BATCH_SIZE - 1n > latestBlock ? latestBlock : fromBlock + BATCH_SIZE - 1n;
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
          const amountInGLMR: number = parseFloat(web3.utils.fromWei(amount.toString(), "ether"));
          console.log(`Payer ${payer} purchased item ${itemId} for ${amountInGLMR} GLMR (userId: ${userId})`);
          await processGamePaymentEvent(fastify, payer, itemId, userId, amountInGLMR, blockNumber);
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
