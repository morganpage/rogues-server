"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function routes(fastify, options) {
    fastify.get("/api/partners", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("GroupedByInvitedBy").find().toArray();
        reply.code(200).send(data);
    });
    fastify.get("/api/tasks_users", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("GroupedByTaskId").find().toArray();
        reply.code(200).send(data);
    });
    fastify.get("/api/invoices_daily_summary", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("InvoicesGroupedByDaySumAmount").find().toArray();
        reply.code(200).send(data);
    });
    fastify.get("/api/invoices", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("invoices").find().sort({ _id: -1 }).toArray();
        reply.code(200).send(data);
    });
    //Count message_queue
    fastify.get("/api/message_queue_unsent", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("message_queue").countDocuments({ sent: false });
        reply.code(200).send(data);
    });
    //Toggle message_send in outmine_settings
    fastify.post("/api/message_send_toggle", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const data = await fastify.mongo.db.collection("outmine_settings").findOne();
        if (!data) {
            reply.code(404).send("No data found");
            return;
        }
        const new_value = !data["message_send"];
        await fastify.mongo.db.collection("outmine_settings").updateOne({}, { $set: { message_send: new_value } });
        reply.code(200).send(new_value);
    });
    //Toggle tasks hide
    fastify.post("/api/tasks_hide_toggle/:task_id", async (req, reply) => {
        if (!fastify.mongo || !fastify.mongo.db) {
            throw new Error("MongoDB is not configured properly");
        }
        const task_id = req.params.task_id;
        const data = await fastify.mongo.db.collection("tasks").findOne({ task_id });
        if (!data) {
            reply.code(404).send("No data found");
            return;
        }
        const new_value = !data["hide"];
        await fastify.mongo.db.collection("tasks").updateOne({ task_id }, { $set: { hide: new_value } });
        reply.code(200).send(new_value);
    });
    // fastify.get("/api/proxy", async (req: FastifyRequest, reply: FastifyReply) => {
    //   //Pass in json url to send request to
    //   const url = (req.query as { url: string }).url;
    //   const response = await fetch(url);
    //   console.log(response);
    //   const json = await response.json();
    //   console.log(json);
    //   reply.code(200).send(json);
    // });
    // fastify.get("/api/missions/:mission_name", async (request: any, reply) => {
    //   if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    //   const mission_name = request.params.mission_name;
    //   const missions = await fastify.mongo.db.collection("missions").find({ mission_name }).toArray();
    //   reply.code(200).send(missions);
    // });
    // fastify.get("/api/missions/tasks/:task_id", async (request: any, reply) => {
    //   if (!fastify.mongo || !fastify.mongo.db) throw new Error("MongoDB is not configured properly");
    //   const task_id = request.params.task_id;
    //   const task = await fastify.mongo.db.collection("missions").findOne({ task_id });
    //   reply.code(200).send(task);
    // });
} // end of routes function
exports.default = routes;
