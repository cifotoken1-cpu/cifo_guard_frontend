const express = require('express');
const VisitController = require('../controllers/VisitController');
const { verifyToken } = require('../middleware/auth-config');

const router = express.Router();

router.post('/', verifyToken, VisitController.createVisit);
router.patch('/:id/close', verifyToken, VisitController.closeVisit);
router.patch('/:id/metadata', verifyToken, VisitController.updateMetadata);
router.get('/cameras/:id', verifyToken, VisitController.getCameraVisits);
router.get('/duration-summary', verifyToken, VisitController.getDurationSummary);

module.exports = router;
