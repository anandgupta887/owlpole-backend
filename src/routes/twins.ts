import express from 'express';
import { getTwins, getTwin, createTwin, updateTwin, deleteTwin, initiateOnboarding } from '../controllers/twinController';
import { protect } from '../middleware/auth';
import { onboardingUpload } from '../middleware/upload';

const router = express.Router();

router.use(protect);

router.post('/initiate-onboarding', onboardingUpload, initiateOnboarding);

router.route('/')
  .get(getTwins)
  .post(createTwin);

router.route('/:id')
  .get(getTwin)
  .put(updateTwin)
  .delete(deleteTwin);

export default router;
