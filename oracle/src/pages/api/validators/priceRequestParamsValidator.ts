import {
  Request,
  Response,
  NextFunction
} from "express";

import {
  PriceRequestParams
} from "../routers/price";

export default function priceRequestParamsValidator(req: Request, res: Response, next: NextFunction) {
  const {
    feed,
  } : PriceRequestParams = req.body;
}