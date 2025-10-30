import express from "express";
import testService from "../service/test";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  const tests = await testService.read();
  return res.json(tests);
});

export default defaultRouter;
