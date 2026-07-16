import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import plantsRouter from "./plants";
import remindersRouter from "./reminders";
import aiRouter from "./ai";
import weatherRouter from "./weather";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(plantsRouter);
router.use(remindersRouter);
router.use(aiRouter);
router.use(weatherRouter);

export default router;
