import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/api/partners", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const data = await fastify.mongo.db.collection("GroupedByInvitedBy").find().toArray();
    reply.code(200).send(data);
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

export default routes;
