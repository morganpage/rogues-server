"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const telegram_1 = require("../utils/telegram");
const tgDataRequest = zod_1.z.object({
    tg_data: zod_1.z.string(),
});
async function routes(fastify, options) {
    fastify.post("/api/telegram-user-info", async (request, reply) => {
        try {
            //console.log(request.body);
            const req = tgDataRequest.parse(request.body);
            const telegramData = (0, telegram_1.processTelegramDataMultiToken)(req.tg_data);
            //const { id, first_name, last_name, username } = JSON.parse(telegramData.data.user);
            if (telegramData.ok) {
                const { start_param } = telegramData.data;
                //console.log(start_param);
                return JSON.parse(telegramData.data.user);
            }
            //console.log(telegramData);
            return { telegramData };
        }
        catch (e) {
            reply.send({ result: "error", error: e });
        }
    });
}
exports.default = routes;
