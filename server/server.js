const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./scores.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playerName TEXT NOT NULL,
                score INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (createErr) => {
            if (createErr) {
                console.error('Error creating table:', createErr.message);
            } else {
                console.log('Scores table created or already exists.');
            }
        });
    }
});

// API to save a new score
app.post('/api/scores', (req, res) => {
    const { playerName, score } = req.body;

    if (!playerName || typeof score !== 'number') {
        return res.status(400).json({ error: 'Player name and score are required.' });
    }

    db.run('INSERT INTO scores (playerName, score) VALUES (?, ?)', [playerName, score], function(err) {
        if (err) {
            console.error('Error inserting score:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Score saved successfully', id: this.lastID });
    });
});

// API to get top 5 scores
app.get('/api/scores/top5', (req, res) => {
    db.all('SELECT playerName, score FROM scores ORDER BY score DESC LIMIT 5', [], (err, rows) => {
        if (err) {
            console.error('Error retrieving top scores:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
