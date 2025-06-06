"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function routes(fastify, options) {
    fastify.get("/api/items-users/:user_id", async (request, reply) => {
        if (!fastify.mongo || !fastify.mongo.db)
            throw new Error("MongoDB is not configured properly");
        const { user_id, item_id, quantity } = request.params;
        //Get from items_users
        const items_users = await fastify.mongo.db.collection("items_users").find({ user_id }).toArray();
        if (!items_users) {
            throw new Error("Item not found");
        }
        reply.code(200).send(items_users);
        // const { user_id, item_id, quantity } = request.params;
        // updateItemsUsers(fastify, user_id, item_id, parseInt(quantity));
        // reply.code(200).send({ user_id, item_id, quantity });
    });
} // end of routes function
exports.default = routes;
