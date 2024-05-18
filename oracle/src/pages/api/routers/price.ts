import { Router } from "express";
import { PriceServiceConnection } from '@pythnetwork/price-service-client';

// @ts-ignore
import Client, { NetworkId } from 'mina-signer';
const client = new Client({
  network: process.env.NETWORK_KIND as NetworkId ?? 'testnet'
});
let privateKey = process.env.PRIVATE_KEY ?? 'EKF65JKw9Q1XWLDZyZNGysBbYG21QbJf3a4xnEoZPZ28LKYGMw53';

const connection = new PriceServiceConnection("https://hermes.pyth.network");
const priceRouter = Router();

type PriceRequestParams = {
  feed: string,
  maxAge: number,
}

priceRouter.post(
  "/",
  async (req, res, next) => {
    const {
      feed,
      maxAge // in seconds
    } : PriceRequestParams = req.body;
    const priceFeed = await connection.getLatestPriceFeeds(
      [feed],
    );

    if (!priceFeed || !priceFeed.length) throw "Failed to fetch the feed.";

    const price = priceFeed[0].getPriceNoOlderThan(maxAge);
    if (!price) throw "Failed to fetch the price. Try increasing `maxAge`";

    const {
      price: feedPrice
    } = price;

    const {
      signature,
      publicKey
    } = client.signFields(
      [
        // Since feed is in hex format, we can BigInt it.
        BigInt(feed),
        BigInt(maxAge),
        BigInt(feedPrice)
      ],
      privateKey
    );

    return {
      data: {
        price: feedPrice,
        maxAge: maxAge,
        feed: feed,
      },
      signature,
      publicKey
    };
  }
);

export type { PriceRequestParams };
export { priceRouter };