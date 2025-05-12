import "dotenv/config";
import express from "express";
import defaultRouter from "./route";
import { config } from 'dotenv';
config();
const app = express();

app.set("trust proxy", true);
app.use(express.json());
app.use("/api", defaultRouter);

app.get("/", async (req, res) => {
	return res.send("TEST API SERVER");
});

const port = +(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
	console.log(`http://localhost:${port} is listening`);
});
