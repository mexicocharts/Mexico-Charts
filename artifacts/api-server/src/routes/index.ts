import { Router, type IRouter } from "express";
import healthRouter from "./health";
import spotifyRouter from "./spotify";
import kworbRouter from "./kworb";

const router: IRouter = Router();

router.use(healthRouter);
router.use(spotifyRouter);
router.use(kworbRouter);

export default router;
