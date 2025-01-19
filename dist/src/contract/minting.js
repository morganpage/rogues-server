"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintGameItemToAddress = mintGameItemToAddress;
exports.getURIFromTokenId = getURIFromTokenId;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const RoguesItems_json_1 = __importDefault(require("../../artifacts/contracts/RoguesItems.sol/RoguesItems.json"));
const contractAddress = process.env.ROGUESITEMS_CONTRACT_ADDRESS || "";
const rpcProvider = process.env.WEB3_PROVIDER || "https://sepolia.boba.network";
async function mintGameItemToAddress(address, itemID, quantity) {
    console.log("Minting");
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const privateKey = process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("MINTER_PRIVATE_KEY is not defined");
    }
    try {
        const wallet = new ethers_1.ethers.Wallet(privateKey, provider);
        const contract = new ethers_1.ethers.Contract(contractAddress, RoguesItems_json_1.default.abi, wallet);
        const tx = await contract.mint(address, itemID, quantity, "0x");
        console.log("Mint TX:", tx.hash);
        await tx.wait();
        return { status: "ok", message: "Minted" };
    }
    catch (e) {
        return { status: "error", message: e.shortMessage };
    }
}
async function getURIFromTokenId(tokenId) {
    const provider = new ethers_1.JsonRpcProvider(rpcProvider);
    const contract = new ethers_1.ethers.Contract(contractAddress, RoguesItems_json_1.default.abi, provider);
    const uri = await contract.uri(tokenId);
    return uri;
}
