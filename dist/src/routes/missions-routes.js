"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function routes(fastify, options) {
    fastify.get("/api/missions", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const missions = await fastify.mongo.db.collection("missions").find().toArray();
        reply.code(200).send(missions);
    });
    fastify.get("/api/missions/:mission_name", async (request, reply) => {
        if (!fastify.mongo || !fastify.mongo.db)
            throw new Error("MongoDB is not configured properly");
        const mission_name = request.params.mission_name;
        const missions = await fastify.mongo.db.collection("missions").find({ mission_name }).toArray();
        reply.code(200).send(missions);
    });
    fastify.get("/api/missions/tasks/:task_id", async (request, reply) => {
        if (!fastify.mongo || !fastify.mongo.db)
            throw new Error("MongoDB is not configured properly");
        const task_id = request.params.task_id;
        const task = await fastify.mongo.db.collection("missions").findOne({ task_id });
        reply.code(200).send(task);
    });
} // end of routes function
exports.default = routes;
