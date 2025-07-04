import express from 'express';
import novelService from '../service/novel';
import { Novel, NovelUpdate } from '../interface/Novel';
import { CompareQuery } from '../../interface/Query';

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  try {
    const novels = await novelService.read();
    return res.json(novels);
  } catch (error) {
    console.log(error);
  }
});
defaultRouter.post("/", async (req, res) => {
  try {
    const novels = await novelService.create(req.body);
    return res.json(novels);
  } catch (error) {
    return res.status(500).json({ error });
  }
});
defaultRouter.patch("/", async (req, res) => {
  try {
    const novels = await novelService.update(42, req.body);
    return res.json(novels);
  } catch (error) {
    console.log(error);
  }
});

defaultRouter.patch('/many', async (req, res) => {
  try {
    const updates: [CompareQuery<Novel>, NovelUpdate][] = [
      [{ id: 42 }, { name: '수정된 제목 1', summary: '수정된 설명 1', isValid: true }],
      [{ id: 43 }, { name: '수정된 제목 2', summary: '수정된 설명 2', isValid: true }]
    ];
    const result = await novelService.updateMany(updates);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

defaultRouter.delete("/", async (req, res) => {
  const novels = await novelService.delete(9);
  return res.json(novels);
});

export default defaultRouter;
