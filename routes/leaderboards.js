
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { moderationEdits, removedEntries } = require('../memoryStore');

const apiKey = process.env.STEAM_PUBLISHER_API_KEY;


//most routes arent named after REST conventions - might (?) change in future
//the file split doesnt make sense either rn

//GET leaderboards for a game
router.get('/getLeaderboards', async (req, res) => {
    try {
        if (!apiKey) {
            return res.status(500).json({ error: "Publisher API key not configured." });
        }

        const { appid } = req.query;
        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('appid', appid);

        const response = await axios.get('https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardsForGame/v2/', {
            params
        });

        const leaderboards = (response.data.response && response.data.response.leaderboards) || [];
        res.json({ leaderboards });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

//GET leaderboard entries
router.get('/getLeaderboardEntries', async (req, res) => {
    try {
        if (!apiKey) {
            return res.status(500).json({ error: "Publisher API key not configured." });
        }

        const { appid, leaderboardid, rangestart, rangeend, datarequest } = req.query;

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('appid', appid);
        params.append('leaderboardid', leaderboardid);
        params.append('rangestart', rangestart);
        params.append('rangeend', rangeend);
        params.append('datarequest', datarequest);

        const response = await axios.get('https://partner.steam-api.com/ISteamLeaderboards/GetLeaderboardEntries/v1/', {
            params
        });

        const info = response.data.leaderboardEntryInformation ||
            (response.data.response && response.data.response.leaderboardEntryInformation);

        if (!info) {
            return res.json({ entries: [], totalEntries: 0 });
        }

        // Map raw entries
        let entries = info.leaderboardEntries.map(e => ({
            steamid: e.steamID,
            score: e.score,
            rank: e.rank
        }));

        // Remove entries that have been marked as removed.
        const removedPrefix = `${leaderboardid}-`;
        entries = entries.filter(entry => {
            const key = `${leaderboardid}-${entry.steamid}`;
            return !removedEntries[key];
        });

        entries = entries.map(entry => {
            const key = `${leaderboardid}-${entry.steamid}`;
            if (moderationEdits[key] !== undefined) {
                entry.score = moderationEdits[key];
            }
            return entry;
        });
        const removedCountForThisLb = Object.keys(removedEntries)
            .filter(k => k.startsWith(`${leaderboardid}-`))
            .length;


        // Apply edits / removals
        entries = entries.map(entry => {
            const key = `${leaderboardid}-${entry.steamid}`;
            if (moderationEdits[key] !== undefined) {
                entry.score = moderationEdits[key];
            }
            return entry;
        });

        res.json({
            entries,
            // subtract what we know we removed in memory
            totalEntries: (info.totalLeaderBoardEntryCount || 0) - removedCountForThisLb
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

//GET player summaries
router.get('/getPlayerSummaries', async (req, res) => {
    try {
        if (!apiKey) {
            return res.status(500).json({ error: "Publisher API key not configured." });
        }

        const { steamids } = req.query;

        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('steamids', steamids);

        const response = await axios.get('https://partner.steam-api.com/ISteamUser/GetPlayerSummaries/v2/', {
            params
        });

        const players = (response.data.response && response.data.response.players) || [];
        res.json({ players });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
