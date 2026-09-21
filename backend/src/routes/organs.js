const express = require('express');
const router = express.Router();
const organController = require('../controllers/organController');

router.get('/event-songs/:eventSongId/organs', organController.getOrgansByEventSong);
router.post('/event-songs/:eventSongId/organs', organController.createOrgan);

router.get('/organs/:organId', organController.getOrganById);
router.put('/organs/:organId', organController.updateOrgan);
router.delete('/organs/:organId', organController.deleteOrgan);

router.post('/organs/:organId/slots', organController.createSlot);
router.put('/organ-slots/:slotId', organController.updateSlot);
router.delete('/organ-slots/:slotId', organController.deleteSlot);

module.exports = router;