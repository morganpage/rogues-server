"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = void 0;
const zod_1 = __importDefault(require("zod"));
const jose = __importStar(require("jose"));
const ethers_1 = require("ethers");
const validateSchema = zod_1.default.object({
    appPubKey: zod_1.default.string(),
});
const verify = async (req, reply) => {
    try {
        const idToken = req.headers.authorization?.split(" ")[1] || "";
        const body = validateSchema.parse(req.body);
        const app_pub_key = body.appPubKey;
        const jwks = jose.createRemoteJWKSet(new URL("https://api.openlogin.com/jwks"));
        const jwtDecoded = await jose.jwtVerify(idToken, jwks, {
            algorithms: ["ES256"],
        });
        const address = ethers_1.ethers.computeAddress("0x" + app_pub_key);
        const public_key = jwtDecoded.payload.wallets[0].public_key;
        if (public_key === app_pub_key) {
            return address;
        }
        else {
            return null;
        }
    }
    catch (e) {
        return null;
    }
};
exports.verify = verify;
