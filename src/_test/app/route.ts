import express from "express";
import testService from "../service/test";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  const tests = await testService.read();
  return res.json(tests);
});

defaultRouter.get("/token", async (req, res) => {
  const tokens = await testService.readToken("at-56bdc7c597373bb7725ab9935049ed961e2ced9675e61ec6511ce3e1222e5f4bcd4985e7b7dfe2d266c18d199873b8d8ba1779ce22595b9cab2741b498a11");
  return res.json(tokens);
});

export default defaultRouter;
