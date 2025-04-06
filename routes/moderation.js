const express = require('express');
const router = express.Router();
const axios = require('axios');
const { moderationEdits, removedEntries } = require('../memoryStore');

router.post('/updateEntry', async (req, res) => {
    try {
        const { appid, leaderboardid, steamid, newScore } = req.body;
        if (!appid || !leaderboardid || !steamid || newScore === undefined) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const apiKey = process.env.STEAM_PUBLISHER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Publisher API key not configured." });
        }

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('appid', appid);
        params.append('leaderboardid', leaderboardid);
        params.append('steamid', steamid);
        params.append('score', newScore);
        params.append('scoremethod', 'ForceUpdate');

        const response = await axios.post(
            'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1/',
            params
        );

        // Update the memory store
        const key = `${leaderboardid}-${steamid}`;
        moderationEdits[key] = newScore;

        return res.json({ success: true, message: "Entry updated successfully", response: response.data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/removeEntry', async (req, res) => {
    try {
        const { appid, leaderboardid, steamid } = req.body;
        if (!appid || !leaderboardid || !steamid) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const apiKey = process.env.STEAM_PUBLISHER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Publisher API key not configured." });
        }

        // For ascending (time-based) boards, a large score effectively "removes" the entry:
        const removalScore = 9999999999;

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('appid', appid);
        params.append('leaderboardid', leaderboardid);
        params.append('steamid', steamid);
        params.append('score', removalScore);
        params.append('scoremethod', 'ForceUpdate');

        const response = await axios.post(
            'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1/',
            params
        );

        // Update the memory store
        const key = `${leaderboardid}-${steamid}`;
        removedEntries[key] = true;

        return res.json({ success: true, message: "Entry removed successfully", response: response.data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;