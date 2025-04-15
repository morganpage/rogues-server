"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrivateKey = exports.generateJwtToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const single_factor_auth_1 = require("@web3auth/single-factor-auth");
const base_1 = require("@web3auth/base");
const ethereum_provider_1 = require("@web3auth/ethereum-provider");
const privateKey = Buffer.from(process.env.PRIVATE_KEY_PEM || "", "base64").toString();
const JWT_KEY_ID = process.env.JWT_KEY_ID || "default";
//Single Factor Authentication for Telegram
const clientId = process.env.WEB3AUTH_CLIENT_ID; // Get your Client ID from Web3Auth Dashboard
if (!clientId)
    throw new Error("WEB3AUTH_CLIENT_ID is not set");
const W3A_VERIFIER_NAME = "web3auth-tg-verifier_1742824075";
const chainConfig = {
    chainId: "0x120",
    displayName: "Boba Ethereum",
    chainNamespace: base_1.CHAIN_NAMESPACES.EIP155,
    tickerName: "Ethereum",
    ticker: "ETH",
    decimals: 18,
    rpcTarget: "https://boba-ethereum.gateway.tenderly.co/6GmVGqQaF2nf60rJWfObWI",
    blockExplorerUrl: "https://bobascan.com/",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};
const chainConfig2 = {
    chainId: "0x70d2",
    displayName: "Boba Sepolia Testnet",
    chainNamespace: base_1.CHAIN_NAMESPACES.EIP155,
    tickerName: "Ethereum",
    ticker: "ETH",
    decimals: 18,
    rpcTarget: "https://sepolia.boba.network",
    blockExplorerUrl: "https://testnet.bobascan.com",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};
const chainConfig1 = {
    chainId: "0xaa36a7",
    displayName: "Ethereum Sepolia Testnet",
    chainNamespace: base_1.CHAIN_NAMESPACES.EIP155,
    tickerName: "Ethereum",
    ticker: "ETH",
    decimals: 18,
    rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};
const privateKeyProvider = new ethereum_provider_1.EthereumPrivateKeyProvider({
    config: { chainConfig },
});
const generateJwtToken = async (userData) => {
    const payload = {
        telegram_id: userData.id,
        username: userData.username,
        avatar_url: userData.photo_url,
        sub: userData.id.toString(),
        name: userData.first_name,
        iss: "https://api.telegram.org", // Issuer
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour expiration, can lower or increase as needed
    };
    try {
        const signed = jsonwebtoken_1.default.sign(payload, privateKey, { algorithm: "RS256", keyid: JWT_KEY_ID });
        return signed;
    }
    catch (e) {
        console.log("Error", e);
    }
};
exports.generateJwtToken = generateJwtToken;
const getPrivateKey = async (idToken, verifierId) => {
    const web3auth = new single_factor_auth_1.Web3Auth({
        clientId, // Get your Client ID from Web3Auth Dashboard
        web3AuthNetwork: base_1.WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        privateKeyProvider,
        mode: single_factor_auth_1.SDK_MODE.NODE,
    });
    await web3auth.init();
    await web3auth.connect({
        verifier: W3A_VERIFIER_NAME || "w3a-telegram-demo",
        verifierId,
        idToken,
    });
    if (!web3auth.provider) {
        throw new Error("web3auth provider is not initialized");
    }
    // The private key returned here is the CoreKitKey
    const ethPrivateKey = await web3auth.provider.request({ method: "eth_private_key" });
    const ethPublicKey = await web3auth.provider.request({ method: "eth_public_key" });
    const ethPublicAddress = await web3auth.provider.request({ method: "eth_accounts" });
    const ethData = {
        ethPrivateKey,
        ethPublicAddress,
        ethPublicKey,
    };
    return ethData;
};
exports.getPrivateKey = getPrivateKey;
