import { FastifyRequest, FastifyReply, FastifyInstance, FastifyPluginOptions } from "fastify";
import { compress } from "../utils/utils";
import zod from "zod";

const giftsDataRequest = zod.object({
  owner_address: zod.string(),
  username: zod.string(),
});

async function routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const APIURL_TONCENTER = "https://toncenter.com/api/v3/";
  const lottieSupport = ["scaredcat", "jellybunny", "kissedfrog", "spyagaric"] as string[];
  const proxyURL = "https://corsproxy.io/?url=";

  fastify.post("/api/gifts", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!fastify.mongo || !fastify.mongo.db) {
      throw new Error("MongoDB is not configured properly");
    }
    const { owner_address, username } = giftsDataRequest.parse(req.body);
    //const { owner_address } = req.params as { owner_address: string };
    const uri = `${APIURL_TONCENTER}nft/items?owner_address=${owner_address}&limit=50&offset=0`;
    const apiKey: string = process.env.TONCENTER_API_KEY!;
    if (!apiKey) {
      throw new Error("TONCENTER_API_KEY is not defined");
    }
    const response = await fetch(uri, {
      headers: {
        "X-API-Key": apiKey,
      },
    }).then((res) => res.json());

    const nft_items = response.nft_items;
    //console.log("nft_items", nft_items.length);
    const gifts = [] as any[];
    let nonLottieCount = 0; //Limit to 1 for now
    let lottieCount = 0; //Limit to 5 for now

    for (let i = 0; i < nft_items.length; i++) {
      const nft_item = nft_items[i];
      const content_uri = nft_item?.content?.uri;
      //content_uri must contain fragment.com/gift/
      if (!content_uri || !content_uri.includes("fragment.com/gift/")) {
        continue;
      }
      //At this point we know its a gift nft
      //Now start counting whether nonLottie or lottie, we only ever want to return up to one nonLottie and up to 5 lotties
      const supported = lottieSupport.some((lottieName) => content_uri.includes(lottieName));
      if (supported) {
        lottieCount++;
        if (lottieCount > 5) continue;
      } else {
        nonLottieCount++;
        if (nonLottieCount > 1) continue;
      }

      const gift = await fastify.mongo.db.collection("telegram_gifts").findOne({ content_uri });
      if (!gift) {
        //console.log("Fetching: ", content_uri);
        const item = await fetch(proxyURL + content_uri).then((res) => {
          if (!res.ok) {
            console.error("Failed to fetch", content_uri);
            return;
          }
          return res.json();
        });

        if (!item || !item.name || !item.image || !item.lottie) {
          continue;
        }
        //If we are here, this is a telegram gift nft, look this up in the db
        const { name, image, lottie } = item;
        //If we support showing the nft, we need to store the lottie json, check name against supported list
        //const supported = lottieSupport.some((lottieName) => name.includes(lottieName));
        const new_gift = { content_uri, name, owner_address, username, image, lottie, lottieCompressedBase64: "" };
        if (supported) {
          const lottieJSON = await fetch(proxyURL + lottie).then((res) => res.json());
          if (!lottieJSON) continue;
          const lottieCompressedBase64 = await compress(lottieJSON);
          new_gift.lottieCompressedBase64 = lottieCompressedBase64;
        }
        await fastify.mongo.db.collection("telegram_gifts").insertOne(new_gift);
        gifts.push(new_gift);
      } else {
        //console.log("Found in db: ", content_uri);
        await fastify.mongo.db.collection("telegram_gifts").updateOne({ content_uri }, { $set: { owner_address, username } });
        gifts.push(gift);
      }
    }
    //console.log("gifts", gifts.length);
    reply.code(200).send(gifts);
  });
}

export default routes;
