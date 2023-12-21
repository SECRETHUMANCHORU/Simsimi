const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;
app.use(express.json());
app.use(bodyParser.json());
app.set('json spaces', 4);
app.use(express.static('public'));
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const httpss = require('./SeExpress/https');
httpss.SeExpress(app);

const filename = 'User-AccessTokens.json';

function generateAccessToken() {
    return crypto.randomBytes(32).toString('hex');
}

function saveUsers(users) {
    fs.writeFileSync(filename, JSON.stringify(users, null, 4));
}

function readUsers() {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function eraseAccessToken(userId) {
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex !== -1) {
        // Reset accessToken to a new one
        users[userIndex].accessToken = generateAccessToken();
        users[userIndex].expiresAt = Date.now() + Days * 24 * 60 * 60 * 1000;
        users[userIndex].correctTime = `${Days * 24 * 60 * 60 * 1000}`;
        saveUsers(users);
        console.log(`Access Token reset for user ${userId}. New Token: ${users[userIndex].accessToken}`);
    } else {
        console.log(`User ${userId} not found.`);
    }
}


function updateAccessTokenExpiration(userId, minutes) {
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex !== -1) {
        const expirationTime = Date.now() + minutes * 60 * 1000;
        const correctTime = Math.max(0, expirationTime - Date.now());

        users[userIndex].expiresAt = expirationTime;
        users[userIndex].correctTime = `${correctTime}`;
        saveUsers(users);
        console.log(`Access Token expiration time updated for user ${userId}.`);
    } else {
        console.log(`User ${userId} not found.`);
    }
}

function checkExpiration(userId) {
    const users = readUsers();
    const userIndex = users.findIndex(user => user.id === userId);

    if (userIndex !== -1) {
        let correctTime = parseInt(users[userIndex].correctTime);

        if (correctTime > 0) {
            correctTime = Math.max(0, correctTime - 5000);
            users[userIndex].correctTime = `${correctTime}`;
        } else {
            // Set accessToken to null when correctTime is used up
            users[userIndex].accessToken = null;
        }

        saveUsers(users);
    } else {
        console.log(`User ${userId} not found.`);
    }
}

function checkAllExpirations() {
    const users = readUsers();
    users.forEach(user => {
        let correctTime = parseInt(user.correctTime);

        if (correctTime > 0) {
            correctTime = Math.max(0, correctTime - 5000);
            user.correctTime = `${correctTime}`;
        } else {
            // Set accessToken to null when correctTime is used up
            user.accessToken = null;
        }
    });

    saveUsers(users);
}

function extractIPAddress(req) {
    const ipAddress = req.ip;
    const ipv4Pattern = /::ffff:/;

    if (ipv4Pattern.test(ipAddress)) {
        return ipAddress.replace(ipv4Pattern, '');
    }

    return ipAddress;
}

app.get('/searchuser', (req, res) => {
    const { UserId } = req.query;

    if (!UserId) {
        return res.status(400).json({ error: 'UserId is required in the query parameters.' });
    }

    const users = readUsers();
    const user = users.find(user => user.id === UserId);

    if (user) {
        const { accessToken, registrationDate, cpBrand } = user;
        res.json({ UserId, Token: accessToken, RegistrationDate: registrationDate, CpBrand: cpBrand });
    } else {
        res.status(404).json({ error: `User ${UserId} not found.` });
    }
});

app.get('/gettoken', (req, res) => {
    const { UserId, Days, CpBrand } = req.query;

    if (!UserId || !Days || !CpBrand) {
        return res.status(400).json({ error: 'UserId, Days, and CpBrand are required in the query parameters.' });
    }

    const existingUsers = readUsers();
    const existingUser = existingUsers.find(user => user.id === UserId);

    // If the user exists and the accessToken is null or expired, generate a new token
    if (existingUser && (existingUser.expiresAt < Date.now() || !existingUser.accessToken)) {
        const newToken = `Simsimi-Sqlite-${generateAccessToken()}`;
        existingUser.accessToken = newToken;
        existingUser.expiresAt = Date.now() + Days * 24 * 60 * 60 * 1000;
        existingUser.correctTime = `${Days * 24 * 60 * 60 * 1000}`;
        saveUsers(existingUsers);

        console.log(`New Access Token for user ${UserId}:`, newToken, 'with CpBrand:', CpBrand, 'from IP:', extractIPAddress(req));
        setInterval(() => {
            checkExpiration(UserId);
        }, 5000);

        res.json({ TOKEN: newToken });
    } else if (existingUser) {
        res.json({ TOKEN: existingUser.accessToken });
    } else {
        const newToken = `Simsimi-Sqlite-${generateAccessToken()}`;
        const newUser = {
            id: UserId,
            accessToken: newToken,
            expiresAt: Date.now() + Days * 24 * 60 * 60 * 1000,
            correctTime: `${Days * 24 * 60 * 60 * 1000}`,
            cpBrand: CpBrand,
            ipAddress: extractIPAddress(req),
            registrationDate: new Date(),
        };

        existingUsers.push(newUser);
        saveUsers(existingUsers);

        console.log(`New Access Token for user ${UserId}:`, newToken, 'with CpBrand:', CpBrand, 'from IP:', extractIPAddress(req));

        setInterval(() => {
            checkExpiration(UserId);
        }, 5000);

        res.json({ TOKEN: newToken });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/pages/home.html');
});
app.get('/research', (req, res) => {
    res.sendFile(__dirname + '/pages/research.html');
});
app.get('/leaderboard', (req, res) => {
    res.sendFile(__dirname + '/pages/leaderboard.html');
});
app.get('/docs', (req, res) => {
    res.sendFile(__dirname + '/pages/docs.html');
});
app.get('/fbdocs', (req, res) => {
 res.sendFile(__dirname + '/pages/fbdocs.html');
});
setInterval(() => {
    checkAllExpirations();
}, 5000);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
