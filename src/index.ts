import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyMongo from "@fastify/mongodb";
import dotenv from "dotenv";
import { processStreakEvents } from "./events/events";
import { mintGameItemToAddress } from "./contract/minting";
import authRoutes from "./routes/auth-routes";

dotenv.config();

const PORT = parseInt(process.env.PORT || "8080", 10);

//mintGameItemToAddress("0x2715FCC42eF0c03fc9D9108a48D8a66ae01000e9", 1, 1);

const fastify = Fastify({ logger: true });
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

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
