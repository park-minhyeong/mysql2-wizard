import express from "express";
import novelService from "../service/novel";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
	const novels = await novelService.read();
	return res.json(novels);
});
defaultRouter.post("/", async (req, res) => {
	try {
		const novels = await novelService.create(req.body)
		return res.json(novels);
	} catch (error) {
		return res.status(500).json({ error });
	}
})
defaultRouter.patch("/", async (req, res) => {
	const novels = await novelService.update(59, {
		novelId: req.body.novelId,
		title: req.body.title,
		text: req.body.text,
	})
	return res.json(novels);
})
defaultRouter.delete("/", async (req, res) => {
	const novels = await novelService.delete(59)
	return res.json(novels);
})

export default defaultRouter;
