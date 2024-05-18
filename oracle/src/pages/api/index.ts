import express from "express";
import {priceRouter} from "./routers/price";

const app = express();

app.use("/api/price", priceRouter);

export default app;