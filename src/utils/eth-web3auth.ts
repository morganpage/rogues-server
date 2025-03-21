import jwt from "jsonwebtoken";
import { Web3Auth, SDK_MODE } from "@web3auth/single-factor-auth";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

const privateKey = Buffer.from(process.env.PRIVATE_KEY_PEM || "", "base64").toString();
const JWT_KEY_ID = process.env.JWT_KEY_ID || "default";

//Single Factor Authentication for Telegram
const clientId = process.env.WEB3AUTH_CLIENT_ID; // Get your Client ID from Web3Auth Dashboard
if (!clientId) throw new Error("WEB3AUTH_CLIENT_ID is not set");

const W3A_VERIFIER_NAME = "web3auth-tg-verifier";

const chainConfig = {
  chainId: "0x70d2",
  displayName: "Boba Sepolia Testnet",
  chainNamespace: CHAIN_NAMESPACES.EIP155,
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
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  tickerName: "Ethereum",
  ticker: "ETH",
  decimals: 18,
  rpcTarget: "https://ethereum-sepolia-rpc.publicnode.com",
  blockExplorerUrl: "https://sepolia.etherscan.io",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

export const generateJwtToken = async (userData: any) => {
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
    const signed = jwt.sign(payload, privateKey, { algorithm: "RS256", keyid: JWT_KEY_ID });
    return signed;
  } catch (e) {
    console.log("Error", e);
  }
};

export const getPrivateKey = async (idToken: any, verifierId: any) => {
  const web3auth = new Web3Auth({
    clientId, // Get your Client ID from Web3Auth Dashboard
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    privateKeyProvider,
    mode: SDK_MODE.NODE,
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
  const ethPublicAddress = await web3auth.provider.request({ method: "eth_accounts" });
  const ethData = {
    ethPrivateKey,
    ethPublicAddress,
  };
  return ethData;
};
