import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { processTelegramDataMultiToken } from "../utils/telegram";

const tgDataRequest = z.object({
  tg_data: z.string(),
});

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.post("/api/telegram-user-info", async (request: FastifyRequest<{ Params: { event_type: string } }>, reply: FastifyReply) => {
    try {
      //console.log(request.body);
      const req = tgDataRequest.parse(request.body);
      const telegramData = processTelegramDataMultiToken(req.tg_data);
      //const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
      if (telegramData.ok) {
        const { start_param } = telegramData.data;
        //console.log(start_param);
        return JSON.parse(telegramData.data.user);
      }
      //console.log(telegramData);
      return { telegramData };
    } catch (e) {
      reply.send({ result: "error", error: e });
    }
  });
}

export default routes;
