const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/residential-maps.json');

const readData = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch { return {}; }
};

const writeData = (data) => {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// GET /residential-map/:estateId
router.get('/:estateId', (req, res) => {
  const data = readData();
  const map = data[req.params.estateId];
  if (!map) return res.status(404).json({ error: 'Estate map not found' });
  res.json(map);
});

// POST /residential-map
router.post('/', (req, res) => {
  const { estateId, ...rest } = req.body;
  if (!estateId) return res.status(400).json({ error: 'estateId is required' });
  const data = readData();
  data[estateId] = { estateId, ...rest, updatedAt: new Date().toISOString() };
  writeData(data);
  res.json(data[estateId]);
});

// PUT /residential-map/:estateId/calibration
router.put('/:estateId/calibration', (req, res) => {
  const data = readData();
  if (!data[req.params.estateId]) return res.status(404).json({ error: 'Estate map not found' });
  data[req.params.estateId].calibration = req.body;
  data[req.params.estateId].updatedAt = new Date().toISOString();
  writeData(data);
  res.json(data[req.params.estateId]);
});

// DELETE /residential-map/:estateId
router.delete('/:estateId', (req, res) => {
  const data = readData();
  if (!data[req.params.estateId]) return res.status(404).json({ error: 'Not found' });
  delete data[req.params.estateId];
  writeData(data);
  res.json({ success: true });
});

module.exports = router;
