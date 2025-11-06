const express = require('express');
const router = express.Router();
const axios = require('axios');
const { moderationEdits, removedEntries } = require('../memoryStore');

//most routes arent named after REST conventions - might (?) change in future
//the file split doesnt make sense either rn


const apiKey = process.env.STEAM_PUBLISHER_API_KEY;



// (PUT) Update entry route
router.post('/updateEntry', async (req, res) => {
    try {
        if (!apiKey) {
            const err = new Error("Publisher API key not configured.");
            err.status = 500;
            throw err;
        }

        const { appid, leaderboardid, steamid, newScore } = req.body;
        if (!appid || !leaderboardid || !steamid || newScore === undefined) {
            return res.status(400).json({ error: "Missing required parameters" });
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

        if (
            response.data &&
            response.data.result &&
            typeof response.data.result === 'object' &&
            response.data.result.result === 27
        ) {
            return res.json({
                success: false,
                error: "WARNING: This user doesnt own the game anymore, the entry cannot be edited. Consider Deleting it instead",
                response: response.data
            });
        }


        const key = `${leaderboardid}-${steamid}`;
        moderationEdits[key] = newScore;

        return res.json({ success: true, message: "Entry updated successfully", response: response.data });
    } catch (error) {
        console.error(error);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
});

// DELETE Remove entry route
router.post('/removeEntry', async (req, res) => {
    try {
        if (!apiKey) {
            const err = new Error("Publisher API key not configured.");
            err.status = 500;
            throw err;
        }

        const { appid, leaderboardid, steamid } = req.body;
        if (!appid || !leaderboardid || !steamid) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('appid', appid);
        params.append('leaderboardid', leaderboardid);
        params.append('steamid', steamid);

        const response = await axios.post(
            'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1/',
            params
        );

        if (
            !response.data ||
            !response.data.result ||
            response.data.result.result !== 1
        ) {
            return res.json({
                success: false,
                error: "ERROR: Steam did not confirm deletion.",
                response: response.data
            });
        }

        // Update the memory store
        const key = `${leaderboardid}-${steamid}`;

        delete moderationEdits[key];

        removedEntries[key] = true;

        return res.json({ success: true, message: "Entry removed successfully", response: response.data });
    } catch (error) {
        console.error(error);
        const status = error.status || 500;
        return res.status(status).json({ error: error.message });
    }
});

module.exports = router;
