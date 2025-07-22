import express from "express";
import novelService from "../service/test";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  try {
    const novels = await novelService.read(64);
    return res.json(novels);
  } catch (error) {
    console.log(error);
  }
});
defaultRouter.post("/", async (req, res) => {
  try {
    // if (!isTestCreate(req.body)) return res.status(400).json({ error: isTestCreate.message(req.body) });
    const novels = await novelService.create(req.body);
    return res.json(novels);
  } catch (error) {
    return res.status(500).json({ error });
  }
});
defaultRouter.patch("/", async (req, res) => {
  try {
    const novels = await novelService.update(req.body);
    return res.json(novels);
  } catch (error) {
    console.log(error);
  }
});

defaultRouter.delete("/", async (req, res) => {
  const novels = await novelService.delete();
  return res.json(novels);
});

export default defaultRouter;
