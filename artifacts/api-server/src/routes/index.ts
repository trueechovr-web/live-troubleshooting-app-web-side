import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customersRouter from "./customers";
import headsetsRouter from "./headsets";
import sessionsRouter from "./sessions";
import dashboardRouter from "./dashboard";
import locationsRouter from "./locations";
import qrDictionaryRouter from "./qr-dictionary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customersRouter);
router.use(headsetsRouter);
router.use(sessionsRouter);
router.use(dashboardRouter);
router.use(locationsRouter);
router.use(qrDictionaryRouter);

export default router;
