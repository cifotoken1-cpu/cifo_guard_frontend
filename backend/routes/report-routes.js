const express = require('express');
const ReportController = require('../controllers/ReportController');
const { verifyToken } = require('../middleware/auth-config');

const router = express.Router();

router.get('/daily-summary', verifyToken, ReportController.getDailySummary);
router.get('/export/csv', verifyToken, ReportController.exportCSV);

module.exports = router;
