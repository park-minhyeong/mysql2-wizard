import express from "express";
import novelService from "../service/novel";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
	try {
		const novels = await novelService.read();
		return res.json(novels);
	}
	catch (error) {
		console.log(error)
	}
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
	try {
		const novels = await novelService.update(10, req.body)
		return res.json(novels);
	}
	catch (error) {
		console.log(error)
	}
})
defaultRouter.delete("/", async (req, res) => {
	const novels = await novelService.delete(9)
	return res.json(novels);
})


export default defaultRouter;
