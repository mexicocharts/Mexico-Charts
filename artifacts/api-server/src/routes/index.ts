import { Router, type IRouter } from "express";
import healthRouter from "./health";
import spotifyRouter from "./spotify";
import kworbRouter from "./kworb";
import chartsRouter from "./charts";
import chartsHubRouter from "./charts-hub";
import touringRouter from "./touring";
import artistsRouter from "./artists";

const router: IRouter = Router();

router.use(healthRouter);
router.use(spotifyRouter);
router.use(kworbRouter);
router.use(chartsRouter);
router.use(chartsHubRouter);
router.use(touringRouter);
router.use(artistsRouter);

export default router;
