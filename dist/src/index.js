"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const mongodb_1 = __importDefault(require("@fastify/mongodb"));
const dotenv_1 = __importDefault(require("dotenv"));
const events_1 = require("./events/events");
const auth_routes_1 = __importDefault(require("./routes/auth-routes"));
dotenv_1.default.config();
const PORT = parseInt(process.env.PORT || "8080", 10);
//mintGameItemToAddress("0x2715FCC42eF0c03fc9D9108a48D8a66ae01000e9", 1, 1);
const fastify = (0, fastify_1.default)({ logger: true });
fastify.register(cors_1.default, {
    origin: "*",
});
console.log("MONGODB", process.env.MONGODB);
fastify.register(mongodb_1.default, {
    forceClose: true,
    url: process.env.MONGODB,
});
fastify.after(() => {
    if (!fastify.mongo) {
        throw new Error("MongoDB is not configured properly");
    }
    console.log("Connected to MongoDB");
    (0, events_1.processStreakEvents)(fastify);
});
fastify.register(auth_routes_1.default);
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
});
