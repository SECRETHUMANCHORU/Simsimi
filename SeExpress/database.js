const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

function initializeDatabase(dbPath) {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, err => {
        if (err) {
            console.error('Error connecting to the database:', err.message);
        } else {
            console.log('Connected to the sim database.');
            createSimTable(db);
        }
    });

    function createSimTable(db) {
        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS sim (asking TEXT, answer TEXT)");
        });
    }

    return db;
}

module.exports = {
    initializeDatabase
};
