import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyHttpProxy from "@fastify/http-proxy";
import fastifyMongo from "@fastify/mongodb";
import dotenv from "dotenv";
import { processStreakEvents } from "./events/events";
import { mintGameItemToAddress } from "./contract/minting";
import authRoutes from "./routes/auth-routes";
import missionsRoutes from "./routes/missions-routes";
import outmineAdminRoutes from "./routes/outmine-admin-routes";
import outmineGiftsRoutes from "./routes/outmine-gifts-routes";
import cooldownsRoutes from "./routes/cooldowns-routes";
import tgRoutes from "./routes/tg-routes";
import { ethRoutes } from "./routes/eth-routes";
import roguesMissionsRoutes from "./routes/rogues-missions-routes";
import itemsRoutes from "./routes/items-routes";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8080", 10);

//mintGameItemToAddress("0x2715FCC42eF0c03fc9D9108a48D8a66ae01000e9", 1, 1);

const fastify = Fastify();
fastify.register(cors, {
  origin: "*",
});
console.log("MONGODB", process.env.MONGODB);

fastify.register(fastifyMongo, {
  forceClose: true,
  url: process.env.MONGODB,
});
fastify.after(() => {
  if (!fastify.mongo) {
    throw new Error("MongoDB is not configured properly");
  }
  console.log("Connected to MongoDB");
  processStreakEvents(fastify);
});

fastify.register(authRoutes);
fastify.register(missionsRoutes);
fastify.register(outmineAdminRoutes);
fastify.register(outmineGiftsRoutes);
fastify.register(cooldownsRoutes);
fastify.register(tgRoutes);
fastify.register(ethRoutes);
fastify.register(roguesMissionsRoutes);
fastify.register(itemsRoutes);

// server.register(require('@fastify/http-proxy'), {
//   upstream: 'http://my-api.example.com',
//   prefix: '/api', // optional
//   http2: false, // optional
// });
fastify.register(fastifyHttpProxy, {
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
