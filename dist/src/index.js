"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
const mongodb_1 = __importDefault(require("@fastify/mongodb"));
const dotenv_1 = __importDefault(require("dotenv"));
const events_1 = require("./events/events");
const auth_routes_1 = __importDefault(require("./routes/auth-routes"));
const missions_routes_1 = __importDefault(require("./routes/missions-routes"));
const outmine_admin_routes_1 = __importDefault(require("./routes/outmine-admin-routes"));
const outmine_gifts_routes_1 = __importDefault(require("./routes/outmine-gifts-routes"));
const cooldowns_routes_1 = __importDefault(require("./routes/cooldowns-routes"));
const tg_routes_1 = __importDefault(require("./routes/tg-routes"));
const eth_routes_1 = require("./routes/eth-routes");
const rogues_missions_routes_1 = __importDefault(require("./routes/rogues-missions-routes"));
const items_routes_1 = __importDefault(require("./routes/items-routes"));
dotenv_1.default.config();
const PORT = parseInt(process.env.PORT || "8080", 10);
const RUNNING_LOCAL = process.env.RUNNING_LOCAL === "true" ? true : false;
if (RUNNING_LOCAL) {
    console.log("Running locally");
}
//mintGameItemToAddress("0x2715FCC42eF0c03fc9D9108a48D8a66ae01000e9", 1, 1);
const fastify = (0, fastify_1.default)();
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
    if (!RUNNING_LOCAL)
        (0, events_1.processStreakEvents)(fastify);
});
fastify.register(auth_routes_1.default);
fastify.register(missions_routes_1.default);
fastify.register(outmine_admin_routes_1.default);
fastify.register(outmine_gifts_routes_1.default);
fastify.register(cooldowns_routes_1.default);
fastify.register(tg_routes_1.default);
fastify.register(eth_routes_1.ethRoutes);
fastify.register(rogues_missions_routes_1.default);
fastify.register(items_routes_1.default);
// server.register(require('@fastify/http-proxy'), {
//   upstream: 'http://my-api.example.com',
//   prefix: '/api', // optional
//   http2: false, // optional
// });
fastify.register(http_proxy_1.default, {
    upstream: "https://nft.fragment.com",
    prefix: "/api/proxy",
    http2: false,
    replyOptions: {
        rewriteHeaders: (headers) => {
            headers["Access-Control-Allow-Origin"] = "*";
            console.log("HEADERS", headers);
            return headers;
        },
    },
});
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
});
