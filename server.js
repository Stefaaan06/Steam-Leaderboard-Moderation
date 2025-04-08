require('dotenv').config(); // Loads the .env file
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

// Routers
const leaderboardsRouter = require('./routes/leaderboards');
const moderationRouter = require('./routes/moderation');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse URL-encoded bodies and JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Serve everything in the "public" folder as static files
app.use(express.static('public'));

// Mount routes
app.use('/leaderboards', leaderboardsRouter);
app.use('/moderation', moderationRouter);

// Fallback route: serve our main UI page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
