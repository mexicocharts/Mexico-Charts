import { Router, type IRouter } from "express";
import healthRouter from "./health";
import spotifyRouter from "./spotify";
import kworbRouter from "./kworb";
import chartsRouter from "./charts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(spotifyRouter);
router.use(kworbRouter);
router.use(chartsRouter);

export default router;
