const express = require('express');
const CountingController = require('../controllers/CountingController');
const { verifyToken } = require('../middleware/auth-config');

const router = express.Router();

router.post('/event', verifyToken, CountingController.createEvent);
router.get('/cameras/:id/count', verifyToken, CountingController.getCameraCount);
router.get('/summary', verifyToken, CountingController.getSummary);

module.exports = router;
