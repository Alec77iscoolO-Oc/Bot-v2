const fs = require("fs");

const FILE = "./database.json";

const defaultDatabase = {
    users: {},
    groups: {}
};

function loadDatabase() {

    if (!fs.existsSync(FILE)) {
        fs.writeFileSync(
            FILE,
            JSON.stringify(defaultDatabase, null, 2)
        );

        return defaultDatabase;
    }

    try {
        return JSON.parse(
            fs.readFileSync(FILE, "utf8")
        );
    } catch (error) {

        console.error(
            "❌ Datenbank konnte nicht gelesen werden:",
            error
        );

        return defaultDatabase;
    }
}

let db = loadDatabase();

function saveDatabase() {
    fs.writeFileSync(
        FILE,
        JSON.stringify(db, null, 2)
    );
}

function getUser(jid) {

    if (!db.users[jid]) {

        db.users[jid] = {
            jid,
            name: "",
            role: "user",
            verified: false,
            money: 0,
            xp: 0,
            level: 1
        };

        saveDatabase();
    }

    return db.users[jid];
}

function getGroup(jid) {

    if (!db.groups[jid]) {

        db.groups[jid] = {
            antiLink: false,
            maxWarnings: 5,
            warnings: {},
            bigEvent: null
        };

        saveDatabase();
    }

    return db.groups[jid];
}

module.exports = {
    db,
    saveDatabase,
    getUser,
    getGroup
};
