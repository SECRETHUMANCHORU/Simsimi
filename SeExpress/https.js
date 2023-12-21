const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.json());
app.set('json spaces', 4);

const { initializeDatabase } = require('./database');
const dbPath = path.join(__dirname, '../database', 'sim.sqlite');
if (!fs.existsSync(path.join(__dirname, '../database'))) {
    fs.mkdirSync(path.join(__dirname, '../database'), { recursive: true });
}
const db = initializeDatabase(dbPath);

function readUsers() {
    try {
        const data = fs.readFileSync(path.join(__dirname, '../User-AccessTokens.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}


function updateRequestCount(user) {
    if (!user.requests) {
        user.requests = 1;
    } else {
        user.requests++;
    }

    const users = readUsers();

    // Update the user data with the new requests count
    const updatedUsers = users.map(existingUser => {
        if (existingUser.accessToken === user.accessToken) {
            return {
                ...existingUser,
                requests: user.requests,
            };
        }
        return existingUser;
    });

    // Save the updated data back to User-AccessTokens.json
    fs.writeFileSync(path.join(__dirname, '../User-AccessTokens.json'), JSON.stringify(updatedUsers, null, 4), 'utf8');
}

function getTopUsers(topCount) {
    const users = readUsers();
    const sortedUsers = users.sort((a, b) => (b.requests || 0) - (a.requests || 0));
    return sortedUsers.slice(0, topCount);
}


function SeExpress(app) {
    app.post('/api/sim', (req, res) => {
        const query = req.body.ask;
        const accessToken = req.body.token;

        if (!accessToken) {
            return res.json({ error: 'Unauthorized - Access token is missing.' });
        }

        const users = readUsers();
        const user = users.find(user => user.accessToken === accessToken);

        if (!user || user.expiresAt < Date.now()) {
            return res.json({ error: 'Unauthorized - Invalid access token.' });
        }

        req.user = user;

        if (!query) {
            return res.json({ error: 'Missing "ask" parameter in the request body.' });
        }

        // Update request count for this user and endpoint
        updateRequestCount(user, '/api/sim');

        db.get("SELECT answer FROM sim WHERE LOWER(asking) = ?", [query.toLowerCase()], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch from the database.' });
            }

            if (row) {
                const answers = row.answer.split(',');
                const answer = answers[Math.floor(Math.random() * answers.length)].trim();
                return res.json({ result: answer });
            } else {
                return res.json({ result: "I don't find a prompt" });
            }
        });
    });

    app.post('/api/teach', (req, res) => {
        const asking = req.body.text1;
        const answer = req.body.text2;
        const accessToken = req.body.token;

        if (!accessToken) {
            return res.json({ error: 'Unauthorized - Access token is missing.' });
        }

        const users = readUsers();
        const user = users.find(user => user.accessToken === accessToken);

        if (!user || user.expiresAt < Date.now()) {
            return res.json({ error: 'Unauthorized - Invalid access token.' });
        }

        req.user = user;

        if (!asking || !answer) {
            return res.json({ error: 'Both "text1" and "text2" parameters are required in the request body.' });
        }

        // Update request count for this user and endpoint
        updateRequestCount(user, '/api/teach');

        db.get("SELECT answer FROM sim WHERE asking = ?", [asking], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch from the database.' });
            }

            if (row) {
                const answers = row.answer.split(',');
                if (!answers.includes(answer)) {
                    answers.unshift(answer);
                }
                db.run("UPDATE sim SET answer = ? WHERE asking = ?", [answers.join(','), asking]);
            } else {
                db.run("INSERT INTO sim (asking, answer) VALUES (?, ?)", [asking, answer]);
            }

            return res.json({ asking: "success", answer: "Answer added successfully" });
        });
    });

    app.get('/api/list/sim', (req, res) => {
        db.all("SELECT asking, answer FROM sim", (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch data from the database.' });
            }

            const simData = rows.map(row => {
                return {
                    asking: row.asking,
                    answer: row.answer ? row.answer.split(',').map(item => item.trim()) : []
                };
            });

            return res.json(simData);
        });
    });

  app.get('/api/tops', (req, res) => {
      const users = readUsers();
      const sortedUsers = users.sort((a, b) => (b.requests || 0) - (a.requests || 0));

      const leaderboard = sortedUsers.map((user, index) => {
          const position = index + 1;
          return {
              id: user.id,
              position,
              requests: user.requests || 0,
          };
      });

      res.json({ leaderboard });
  });
}

module.exports = {
    SeExpress
};
