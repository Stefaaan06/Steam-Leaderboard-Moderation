const express = require('express');
const router = express.Router();
const axios = require('axios');
const { moderationEdits, removedEntries } = require('../memoryStore');



async function setLeaderboardScore({ appid, leaderboardid, steamid, score }) {
    const apiKey = process.env.STEAM_PUBLISHER_API_KEY;
    if (!apiKey) {
        const err = new Error("Publisher API key not configured.");
        err.status = 500;
        throw err;
    }

    const params = new URLSearchParams();
    params.append('key', apiKey);
    params.append('appid', appid);
    params.append('leaderboardid', leaderboardid);
    params.append('steamid', steamid);
    params.append('score', score);
    params.append('scoremethod', 'ForceUpdate');

    const response = await axios.post(
        'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1/',
        params
    );
    return response.data;
}

// Update entry route
router.post('/updateEntry', async (req, res) => {
    try {
        const { appid, leaderboardid, steamid, newScore } = req.body;
        if (!appid || !leaderboardid || !steamid || newScore === undefined) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const data = await setLeaderboardScore({ appid, leaderboardid, steamid, score: newScore });

        // Update the memory store
        const key = `${leaderboardid}-${steamid}`;
        moderationEdits[key] = newScore;

        return res.json({ success: true, message: "Entry updated successfully", response: data });
    } catch (error) {
        console.error(error);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
});

// Remove entry route: just calls updateEntry with a huge score
router.post('/removeEntry', async (req, res) => {
    try {
        const { appid, leaderboardid, steamid } = req.body;
        if (!appid || !leaderboardid || !steamid) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // For ascending (time-based) boards, a large score effectively "removes" the entry:
        const removalScore = 9999999999;

        const data = await setLeaderboardScore({ appid, leaderboardid, steamid, score: removalScore });

        // Update the memory store
        const key = `${leaderboardid}-${steamid}`;
        moderationEdits[key] = removalScore;

        return res.json({ success: true, message: "Entry removed successfully", response: data });
    } catch (error) {
        console.error(error);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
});

module.exports = router;
