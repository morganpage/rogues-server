"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = __importDefault(require("zod"));
const utils_1 = require("../utils/utils");
const streaks_1 = require("../contract/streaks");
const minting_1 = require("../contract/minting");
const db_1 = require("../db/db");
const streaksdb_1 = require("../contract/streaksdb");
const streaks_reactive_1 = require("../contract/streaks-reactive");
const validateSchema = zod_1.default.object({
    appPubKey: zod_1.default.string(),
});
async function routes(fastify, options) {
    fastify.get("/api/health", async (req, reply) => {
        reply.code(200).send({ status: "ok" });
    });
    fastify.post("/api/user_last_login", async (req, reply) => {
        try {
            const address = await (0, utils_1.verify)(req, reply);
            if (address) {
                await (0, db_1.updateUserLastLogin)(fastify, address);
                reply.code(200).send({ status: "ok", message: "User Last Login Updated" });
            }
            else {
                reply.code(401).send({ status: "error", message: "Validation Failed" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.post("/api/streak", async (req, reply) => {
        try {
            const address = await (0, utils_1.verify)(req, reply);
            if (address) {
                let claimedReply = await (0, streaks_1.claimStreakFor)(address);
                if (claimedReply.status === "ok") {
                    reply.code(200).send(claimedReply);
                }
                else {
                    reply.code(400).send(claimedReply);
                }
            }
            else {
                reply.code(401).send({ status: "error", message: "Validation Failed" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.get("/api/streak_to_points", async (req, reply) => {
        try {
            const streak = req.query.streak;
            if (streak) {
                let points = await (0, db_1.getStreakToPoints)(fastify, streak);
                reply.code(200).send({ status: "ok", points });
            }
            else {
                let streak_to_points = await (0, db_1.getAllStreakToPoints)(fastify);
                reply.code(200).send(streak_to_points);
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.get("/api/streak_info", async (req, reply) => {
        try {
            const address = req.query.address;
            if (address) {
                let streakInfo = await (0, streaks_1.getStreakStatus)(address);
                reply.code(200).send({ status: "ok", streakInfo });
            }
            else {
                reply.code(400).send({ status: "error", message: "Address required" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.get("/api/streak_info_reactive", async (req, reply) => {
        try {
            const address = req.query.address;
            if (address) {
                let streakInfo = await (0, streaks_reactive_1.getStreakStatusReactive)(address);
                reply.code(200).send({ status: "ok", streakInfo });
            }
            else {
                reply.code(400).send({ status: "error", message: "Address required" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.get("/api/streak_info_db", async (req, reply) => {
        try {
            const address = req.query.address;
            if (address) {
                let streakInfo = await (0, streaksdb_1.getStreakStatusDB)(fastify, address);
                reply.code(200).send({ status: "ok", streakInfo });
            }
            else {
                reply.code(400).send({ status: "error", message: "Address required" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.get("/api/gameItemFromTokenId", async (req, reply) => {
        try {
            const tokenId = req.query.tokenId;
            if (tokenId) {
                let uri = await (0, minting_1.getURIFromTokenId)(tokenId);
                uri = uri.replace("ipfs://", "https://roguefoxguild.mypinata.cloud/ipfs/");
                const response = await fetch(uri).then((res) => res.json());
                response.image = response.image.replace("ipfs://", "https://roguefoxguild.mypinata.cloud/ipfs/");
                reply.code(200).send({ status: "ok", ...response });
            }
            else {
                reply.code(400).send({ status: "error", message: "TokenId required" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    //Get all the token milestone mappings - getStreakTokenMilestones
    fastify.get("/api/streak_milestones_to_tokenIds", async (req, reply) => {
        try {
            let milestones_tokens = await (0, streaks_1.getStreakMilestonesToTokensIds)();
            let milestones = milestones_tokens[0].map((milestone) => parseInt(milestone));
            let tokens = milestones_tokens[1].map((token) => parseInt(token));
            let mapping_array = [];
            for (let i = 0; i < milestones.length; i++) {
                mapping_array.push({ milestone: milestones[i], tokenId: tokens[i] });
            }
            reply.code(200).send(mapping_array);
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    //getStreakRewardContractAddress
    // fastify.get("/api/streak_reward_contract", async (req: FastifyRequest, reply: FastifyReply) => {
    //   try {
    //     let streakRewardContractAddress = await getStreakRewardContractAddress();
    //     reply.code(200).send({ status: "ok", streakRewardContractAddress });
    //   } catch (e: any) {
    //     reply.code(400).send({ status: "error", message: e.message });
    //   }
    // });
    //Just for testing
    fastify.post("/api/mint", async (req, reply) => {
        try {
            const secret = req.body.secret;
            const address = await (0, utils_1.verify)(req, reply);
            if (address && secret === process.env.MINT_SECRET) {
                let mintReply = await (0, minting_1.mintGameItemToAddress)(address, 11, 1);
                if (mintReply.status === "ok") {
                    reply.code(200).send(mintReply);
                }
                else {
                    reply.code(400).send(mintReply);
                }
            }
            else {
                reply.code(401).send({ status: "error", message: "Validation Failed" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.post("/api/validate", async (req, reply) => {
        try {
            const address = await (0, utils_1.verify)(req, reply);
            if (address) {
                reply.code(200).send({ status: "ok", message: "Validation Success", address });
            }
            else {
                reply.code(401).send({ status: "error", message: "Validation Failed" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
    fastify.post("/api/streakHoursAgo", async (req, reply) => {
        try {
            const secret = req.body.secret;
            const address = await (0, utils_1.verify)(req, reply);
            if (address && secret === process.env.MINT_SECRET) {
                let claimedReply = await (0, streaks_1.claimHoursAgo)(address, 25);
                if (claimedReply.status === "ok") {
                    reply.code(200).send(claimedReply);
                }
                else {
                    reply.code(400).send(claimedReply);
                }
            }
            else {
                reply.code(401).send({ status: "error", message: "Validation Failed" });
            }
        }
        catch (e) {
            reply.code(400).send({ status: "error", message: e.message });
        }
    });
}
exports.default = routes;
