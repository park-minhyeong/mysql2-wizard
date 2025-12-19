import express from "express";
import testService from "../service/test";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  const tests = await testService.read();
  return res.json(tests);
});

defaultRouter.post("/", async (req, res) => {
  const test = await testService.create(req.body);
  return res.json(test);
});


export default defaultRouter;
