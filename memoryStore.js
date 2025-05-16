//Cache for entries
// Key format in these objects: `${leaderboardid}-${steamid}`
const moderationEdits = {};     //this holds the edits to a leaderboard because it doesnt update in automatically
const removedEntries = {};

module.exports = {
    moderationEdits,
    removedEntries
};
