import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { compress } from "../utils/utils";

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const APIURL_TONCENTER = "https://toncenter.com/api/v3/";

  fastify.get("/api/gifts/:owner_address", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const { owner_address } = req.params as { owner_address: string };
    const uri = `${APIURL_TONCENTER}nft/items?owner_address=${owner_address}&limit=100&offset=0`;
    const response = await fetch(uri, {
      headers: {
        "x-cors-api-key": "temp_af800619ba260c28937f65b803934eb8",
      },
    }).then((res) => res.json());

    const nft_items = response.nft_items;
    console.log("nft_items", nft_items.length);
    const gifts = [] as any[];
    for (let i = 0; i < nft_items.length; i++) {
      const nft_item = nft_items[i];
      const content_uri = nft_item?.content?.uri;
      if (!content_uri) {
        continue;
      }
      const gift = await fastify.mongo.db.collection("telegram_gifts").findOne({ content_uri });
      if (!gift) {
        const item = await fetch(content_uri).then((res) => res.json());
        if (!item || !item.name || !item.image || !item.lottie) {
          continue;
        }
        //If we are here, this is a telegram gift nft, look this up in the db
        // Now process the lottie json
        const { name, image, lottie } = item;
        const lottieJSON = await fetch(lottie).then((res) => res.json());
        if (!lottieJSON) {
          continue;
        }
        const lottieCompressedBase64 = await compress(lottieJSON);
        const new_gift = { content_uri, name, owner_address, image, lottie, lottieCompressedBase64 };
        await fastify.mongo.db.collection("telegram_gifts").insertOne(new_gift);
        gifts.push(new_gift);
      } else {
        //console.log("Updating");
        await fastify.mongo.db.collection("telegram_gifts").updateOne({ content_uri }, { $set: { owner_address } });
        gifts.push(gift);
      }
    }
    reply.code(200).send(gifts);
  });
}

export default routes;
