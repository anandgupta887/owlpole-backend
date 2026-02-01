import express from 'express';
import { getTwins, getTwin, createTwin, updateTwin, deleteTwin } from '../controllers/twinController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getTwins)
  .post(createTwin);

router.route('/:id')
  .get(getTwin)
  .put(updateTwin)
  .delete(deleteTwin);

export default router;
