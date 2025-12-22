import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get("/api/partners", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const data = await fastify.mongo.db.collection("GroupedByInvitedBy").find().toArray();
    reply.code(200).send(data);
  });

  fastify.get("/api/tasks_users", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const data = await fastify.mongo.db.collection("GroupedByTaskId").find().toArray();
    reply.code(200).send(data);
  });

  // fastify.get("/api/invoices_daily_summary", async (req: FastifyRequest, reply: FastifyReply) => {
  //   if (!fastify.mongo || !fastify.mongo.db) {
  //     throw new Error("MongoDB is not configured properly");
  //   }
  //   const data = await fastify.mongo.db.collection("InvoicesGroupedByDaySumAmount").find().toArray();
  //   reply.code(200).send(data);
  // });

  fastify.get("/api/invoices_daily_summary", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    //Get all coinproducts
    const coin_products = await fastify.mongo.db.collection("coin_products").find().toArray();
    const coin_product_ids = coin_products.map((product) => product.product_id);
    //Create a lookup product_id to price map
    const product_price_map: { [key: string]: number } = {};
    coin_products.forEach((product) => {
      product_price_map[product.product_id] = product.price;
    });
    //Just top 100 invoices sorted by most recent
    const data = await fastify.mongo.db
      .collection("invoices")
      .find({ product: { $in: coin_product_ids } })
      .sort({ _id: -1 })
      .limit(100)
      .toArray();
    //Aggregate by day and sum amount
    const daily_summary: { [key: string]: number } = {};
    data.forEach((invoice) => {
      const date = new Date(invoice.createdAt);
      const day = date.toISOString().split("T")[0];
      if (!daily_summary[day]) {
        daily_summary[day] = 0;
      }
      //console.log("invoice.product", day, invoice.product, product_price_map[invoice.product]);
      daily_summary[day] += product_price_map[invoice.product] || 0;
    });
    //return as an array _id, totalAmount to 2 decimal places
    const daily_summary_array = Object.keys(daily_summary).map((day) => {
      return { _id: day, totalAmount: parseFloat(daily_summary[day].toFixed(2)) };
    });
    reply.code(200).send(daily_summary_array);
  });

  fastify.get("/api/invoices", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    //Just top 100 invoices sorted by most recent
    const data = await fastify.mongo.db.collection("invoices").find().sort({ _id: -1 }).limit(100).toArray();
    reply.code(200).send(data);
  });

  fastify.get("/api/invoices_revenue", async (req: FastifyRequest, reply: FastifyReply) => {
    //Invoices that are actually for items that generate revenue
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    //Get all coinproducts
    const coin_products = await fastify.mongo.db.collection("coin_products").find().toArray();
    const coin_product_ids = coin_products.map((product) => product.product_id);
    //Just top 100 invoices sorted by most recent
    const data = await fastify.mongo.db
      .collection("invoices")
      .find({ product: { $in: coin_product_ids } })
      .sort({ _id: -1 })
      .limit(100)
      .toArray();

    //Just top 100 invoices sorted by most recent
    //const data = await fastify.mongo.db.collection("invoices").find().sort({ _id: -1 }).limit(100).toArray();
    reply.code(200).send(data);
  });

  //Count message_queue
  fastify.get("/api/message_queue_unsent", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const data = await fastify.mongo.db.collection("message_queue").countDocuments({ sent: false });
    reply.code(200).send(data);
  });

  //Toggle message_send in outmine_settings
  fastify.post("/api/message_send_toggle", async (req: FastifyRequest, reply: FastifyReply) => {
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
  fastify.post("/api/tasks_hide_toggle/:task_id", async (req: FastifyRequest<{ Params: { task_id: string } }>, reply: FastifyReply) => {
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

export default routes;
