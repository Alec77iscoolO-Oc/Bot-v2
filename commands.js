const config = require("./config");
const {
    getUser,
    getGroup,
    saveDatabase
} = require("./database");


// ========================================
// HILFSFUNKTIONEN
// ========================================

function getNumber(jid) {
    return jid.split("@")[0];
}

function isOwner(jid) {
    return getNumber(jid) === config.owner;
}

function random(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function isGroup(jid) {
    return jid.endsWith("@g.us");
}

async function isAdmin(sock, groupJid, userJid) {

    try {

        const metadata =
            await sock.groupMetadata(groupJid);

        const participant =
            metadata.participants.find(
                p => p.id === userJid
            );

        if (!participant) {
            return false;
        }

        return (
            participant.admin === "admin" ||
            participant.admin === "superadmin"
        );

    } catch (error) {

        console.error(
            "Adminprüfung fehlgeschlagen:",
            error
        );

        return false;
    }
}

function getMentionedJid(message) {

    return (
        message.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0] || null
    );
}


// ========================================
// HELP
// ========================================

async function commandHelp(sock, jid) {

    const text = `
🤖 ${config.botName}

📌 ALLGEMEINE BEFEHLE

!verfy
Verifiziert dich beim Bot.

!ich
Zeigt dein Profil.

!game
Startet ein kleines Spiel.

!bank
Zeigt dein Bankkonto.

!help
Zeigt diese Hilfe.

👮 GRUPPENADMIN

!anti link
Anti-Link an/aus.

!warn @user
Gibt eine Warnung.

!warnän 0-5
Legt die maximale Warnungszahl fest.

!kill group @user
Entfernt einen markierten Benutzer.

!großevent
Startet ein großes Event.

👑 OWNER

!rolle user: NUMMER costum rolle: ROLLE
Ändert die Rolle eines Benutzers.
`;

    await sock.sendMessage(jid, {
        text: text.trim()
    });
}


// ========================================
// VERIFIZIERUNG
// ========================================

async function commandVerify(sock, jid, sender) {

    if (isGroup(jid)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Die Verifizierung muss privat beim Bot erfolgen."
        });
    }

    const user = getUser(sender);

    user.verified = true;
    user.role = "user";

    saveDatabase();

    await sock.sendMessage(jid, {
        text:
            "✅ Verfy ist erfolgreich durchgeführt.\n\n" +
            "👤 Rolle: user"
    });
}


// ========================================
// PROFIL
// ========================================

async function commandProfile(sock, jid, sender) {

    const user = getUser(sender);

    const nextLevelXP =
        user.level * 1000;

    await sock.sendMessage(jid, {
        text:
            "👤 DEIN PROFIL\n\n" +
            `Name: ${user.name || "Unbekannt"}\n` +
            `Rolle: ${user.role}\n` +
            `⭐ XP: ${user.xp}\n` +
            `💰 Geld: ${user.money}\n` +
            `📈 Level: ${user.level}\n` +
            `🎯 Nächstes Level: ${nextLevelXP} XP`
    });
}


// ========================================
// LEVEL SYSTEM
// ========================================

function updateLevel(user) {

    const newLevel =
        Math.max(
            1,
            Math.floor(user.xp / 1000) + 1
        );

    if (newLevel > user.level) {

        user.level = newLevel;

        return true;
    }

    return false;
}


// ========================================
// GAME
// ========================================

async function commandGame(sock, jid, sender) {

    const user = getUser(sender);

    const money = random(
        config.gameMoneyMin,
        config.gameMoneyMax
    );

    const xp = random(
        config.gameXPMin,
        config.gameXPMax
    );

    user.money += money;
    user.xp += xp;

    const levelUp =
        updateLevel(user);

    saveDatabase();

    let text =
        "🎮 GAME BEENDET!\n\n" +
        `💰 +${money} Geld\n` +
        `⭐ +${xp} XP`;

    if (levelUp) {
        text +=
            `\n\n🎉 LEVEL UP!\n` +
            `📈 Level ${user.level}`;
    }

    await sock.sendMessage(jid, {
        text
    });
}


// ========================================
// BANK
// ========================================

async function commandBank(sock, jid, sender, args) {

    const user = getUser(sender);

    const subCommand =
        args[0]?.toLowerCase();

    // -------------------------
    // SALDO
    // -------------------------

    if (
        !subCommand ||
        subCommand === "saldo"
    ) {

        return sock.sendMessage(jid, {
            text:
                "🏦 BANK\n\n" +
                `💰 Geld: ${user.money}\n` +
                `⭐ XP: ${user.xp}`
        });
    }


    // -------------------------
    // XP KAUFEN
    // -------------------------

    if (subCommand === "xp") {

        const amount =
            Number(args[1]);

        if (!Number.isInteger(amount) || amount <= 0) {

            return sock.sendMessage(jid, {
                text:
                    "❌ Beispiel:\n" +
                    "!bank xp 100"
            });
        }

        const price = amount;

        if (user.money < price) {

            return sock.sendMessage(jid, {
                text:
                    "❌ Du hast nicht genug Geld."
            });
        }

        user.money -= price;
        user.xp += amount;

        updateLevel(user);
        saveDatabase();

        return sock.sendMessage(jid, {
            text:
                "🏦 BANK\n\n" +
                `💰 -${price} Geld\n` +
                `⭐ +${amount} XP`
        });
    }


    // -------------------------
    // GELD
    // -------------------------

    if (subCommand === "geld") {

        const amount =
            Number(args[1]);

        if (!Number.isInteger(amount) || amount <= 0) {

            return sock.sendMessage(jid, {
                text:
                    "❌ Beispiel:\n" +
                    "!bank geld 100"
            });
        }

        user.money += amount;

        saveDatabase();

        return sock.sendMessage(jid, {
            text:
                `💰 +${amount} Geld`
        });
    }


    // -------------------------
    // UNBEKANNT
    // -------------------------

    return sock.sendMessage(jid, {
        text:
            "🏦 BANK BEFEHLE\n\n" +
            "!bank\n" +
            "!bank saldo\n" +
            "!bank xp 100\n" +
            "!bank geld 100"
    });
}


// ========================================
// ANTI LINK
// ========================================

async function commandAntiLink(
    sock,
    jid,
    sender,
    args
) {

    const admin =
        await isAdmin(
            sock,
            jid,
            sender
        );

    if (!admin && !isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur Gruppenadmins dürfen das."
        });
    }

    const group =
        getGroup(jid);

    if (
        args[0]?.toLowerCase() !== "link"
    ) {

        return sock.sendMessage(jid, {
            text:
                "Benutzung:\n!anti link"
        });
    }

    group.antiLink =
        !group.antiLink;

    saveDatabase();

    await sock.sendMessage(jid, {
        text:
            "🔗 Anti-Link: " +
            (
                group.antiLink
                    ? "AKTIVIERT ✅"
                    : "DEAKTIVIERT ❌"
            )
    });
}


// ========================================
// WARN
// ========================================

async function commandWarn(
    sock,
    jid,
    sender,
    message
) {

    const admin =
        await isAdmin(
            sock,
            jid,
            sender
        );

    if (!admin && !isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur Gruppenadmins dürfen warnen."
        });
    }

    const target =
        getMentionedJid(message);

    if (!target) {

        return sock.sendMessage(jid, {
            text:
                "❌ Benutzung:\n!warn @Benutzer"
        });
    }

    const group =
        getGroup(jid);

    if (!group.warnings[target]) {
        group.warnings[target] = 0;
    }

    group.warnings[target]++;

    const warns =
        group.warnings[target];

    saveDatabase();

    if (
        group.maxWarnings > 0 &&
        warns >= group.maxWarnings
    ) {

        try {

            await sock.groupParticipantsUpdate(
                jid,
                [target],
                "remove"
            );

        } catch (error) {

            console.error(
                "Konnte Benutzer nicht entfernen:",
                error
            );

            return sock.sendMessage(jid, {
                text:
                    "❌ Ich konnte den Benutzer nicht entfernen. " +
                    "Prüfe, ob ich Gruppenadmin bin."
            });
        }

        group.warnings[target] = 0;

        saveDatabase();

        return sock.sendMessage(jid, {
            text:
                `🚨 @${getNumber(target)} wurde entfernt.`,
            mentions: [target]
        });
    }

    await sock.sendMessage(jid, {
        text:
            `⚠️ @${getNumber(target)} hat eine Warnung.\n\n` +
            `Warnungen: ${warns}/${group.maxWarnings}`,
        mentions: [target]
    });
}


// ========================================
// WARN LIMIT
// ========================================

async function commandWarnLimit(
    sock,
    jid,
    sender,
    args
) {

    const admin =
        await isAdmin(
            sock,
            jid,
            sender
        );

    if (!admin && !isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur Gruppenadmins dürfen das."
        });
    }

    const amount =
        Number(args[0]);

    if (
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > 5
    ) {

        return sock.sendMessage(jid, {
            text:
                "❌ Benutze eine Zahl von 0 bis 5."
        });
    }

    const group =
        getGroup(jid);

    group.maxWarnings =
        amount;

    saveDatabase();

    await sock.sendMessage(jid, {
        text:
            `✅ Maximale Warnungen: ${amount}`
    });
}


// ========================================
// KILL GROUP
// ========================================

async function commandKillGroup(
    sock,
    jid,
    sender,
    message
) {

    const admin =
        await isAdmin(
            sock,
            jid,
            sender
        );

    if (!admin && !isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur Gruppenadmins dürfen das."
        });
    }

    const target =
        getMentionedJid(message);

    if (!target) {

        return sock.sendMessage(jid, {
            text:
                "❌ Benutzung:\n!kill group @Benutzer"
        });
    }

    if (target === sender) {

        return sock.sendMessage(jid, {
            text:
                "❌ Du kannst dich nicht selbst entfernen."
        });
    }

    try {

        await sock.groupParticipantsUpdate(
            jid,
            [target],
            "remove"
        );

        await sock.sendMessage(jid, {
            text:
                `🛡️ @${getNumber(target)} wurde entfernt.`,
            mentions: [target]
        });

    } catch (error) {

        console.error(error);

        await sock.sendMessage(jid, {
            text:
                "❌ Das Entfernen ist fehlgeschlagen.\n" +
                "Stelle sicher, dass der Bot Gruppenadmin ist."
        });
    }
}


// ========================================
// GROSSEVENT
// ========================================

async function commandBigEvent(
    sock,
    jid,
    sender
) {

    const admin =
        await isAdmin(
            sock,
            jid,
            sender
        );

    if (!admin && !isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur Gruppenadmins dürfen Events starten."
        });
    }

    const group =
        getGroup(jid);

    if (group.bigEvent) {

        return sock.sendMessage(jid, {
            text:
                "❌ Es läuft bereits ein großes Event."
        });
    }

    group.bigEvent = {
        startedAt: Date.now(),
        startedBy: sender,
        participants: []
    };

    saveDatabase();

    await sock.sendMessage(jid, {
        text:
            "🎉 GROSSEVENT GESTARTET!\n\n" +
            "⏱️ Dauer: bis zu 3 Tage\n\n" +
            "🏆 Belohnung:\n" +
            `💰 ${config.bigEventMoney} Geld\n` +
            `⭐ ${config.bigEventXP} XP\n\n` +
            "Teilnehmen mit:\n" +
            "!event join"
    });
}


// ========================================
// EVENT JOIN
// ========================================

async function commandEvent(
    sock,
    jid,
    sender,
    args
) {

    const group =
        getGroup(jid);

    if (!group.bigEvent) {

        return sock.sendMessage(jid, {
            text:
                "❌ Es läuft gerade kein großes Event."
        });
    }

    if (
        Date.now() -
        group.bigEvent.startedAt >=
        config.bigEventDuration
    ) {

        group.bigEvent = null;

        saveDatabase();

        return sock.sendMessage(jid, {
            text:
                "⏱️ Das Event ist abgelaufen."
        });
    }

    if (
        args[0]?.toLowerCase() !== "join"
    ) {

        return sock.sendMessage(jid, {
            text:
                "Benutzung:\n!event join"
        });
    }

    if (
        !group.bigEvent.participants.includes(sender)
    ) {

        group.bigEvent.participants.push(sender);

        saveDatabase();

        return sock.sendMessage(jid, {
            text:
                "✅ Du bist beim Event dabei!"
        });
    }

    await sock.sendMessage(jid, {
        text:
            "ℹ️ Du bist bereits beim Event dabei."
    });
}


// ========================================
// ROLLEN-SYSTEM
// ========================================

async function commandRole(
    sock,
    jid,
    sender,
    text
) {

    if (!isOwner(sender)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Nur der Bot-Owner darf Rollen ändern."
        });
    }

    const match =
        text.match(
            /user:\s*([0-9]+)\s+costum\s+rolle:\s*(.+)/i
        );

    if (!match) {

        return sock.sendMessage(jid, {
            text:
                "❌ Falscher Aufbau.\n\n" +
                "!rolle user: 49123456789 costum rolle: VIP"
        });
    }

    const number =
        match[1];

    const role =
        match[2].trim();

    const target =
        `${number}@s.whatsapp.net`;

    const user =
        getUser(target);

    user.role =
        role;

    saveDatabase();

    await sock.sendMessage(jid, {
        text:
            "👑 ROLLE GEÄNDERT\n\n" +
            `📱 User: ${number}\n` +
            `🎭 Rolle: ${role}`
    });
}


// ========================================
// BEFEHL VERARBEITEN
// ========================================

async function handleCommand(
    sock,
    message,
    jid,
    sender,
    command,
    args,
    text
) {

    const user =
        getUser(sender);

    user.name =
        message.pushName ||
        getNumber(sender);

    saveDatabase();


    // -------------------------
    // COMMANDS OHNE VERIFIZIERUNG
    // -------------------------

    if (command === "verfy") {
        return commandVerify(
            sock,
            jid,
            sender
        );
    }

    if (command === "help") {
        return commandHelp(
            sock,
            jid
        );
    }


    // -------------------------
    // VERIFIZIERUNG
    // -------------------------

    if (
        !user.verified &&
        !isOwner(sender)
    ) {

        return sock.sendMessage(jid, {
            text:
                "❌ Du bist noch nicht verifiziert.\n\n" +
                "Schreibe dem Bot privat:\n" +
                "!verfy"
        });
    }


    // -------------------------
    // ALLGEMEIN
    // -------------------------

    if (command === "ich") {

        return commandProfile(
            sock,
            jid,
            sender
        );
    }

    if (command === "game") {

        return commandGame(
            sock,
            jid,
            sender
        );
    }

    if (command === "bank") {

        return commandBank(
            sock,
            jid,
            sender,
            args
        );
    }


    // -------------------------
    // OWNER
    // -------------------------

    if (command === "rolle") {

        return commandRole(
            sock,
            jid,
            sender,
            text
        );
    }


    // -------------------------
    // GRUPPEN
    // -------------------------

    if (!isGroup(jid)) {

        return sock.sendMessage(jid, {
            text:
                "❌ Dieser Befehl funktioniert nur in Gruppen."
        });
    }

    if (
        command === "anti" &&
        args[0]?.toLowerCase() === "link"
    ) {

        return commandAntiLink(
            sock,
            jid,
            sender,
            args
        );
    }

    if (command === "warn") {

        return commandWarn(
            sock,
            jid,
            sender,
            message
        );
    }

    if (
        command === "warnän" ||
        command === "warnan"
    ) {

        return commandWarnLimit(
            sock,
            jid,
            sender,
            args
        );
    }

    if (
        command === "kill" &&
        args[0]?.toLowerCase() === "group"
    ) {

        return commandKillGroup(
            sock,
            jid,
            sender,
            message
        );
    }

    if (command === "großevent") {

        return commandBigEvent(
            sock,
            jid,
            sender
        );
    }

    if (command === "event") {

        return commandEvent(
            sock,
            jid,
            sender,
            args
        );
    }

    await sock.sendMessage(jid, {
        text:
            "❓ Unbekannter Befehl.\n\n" +
            "Benutze !help"
    });
}


module.exports = {
    handleCommand,
    getGroup,
    isGroup,
    isAdmin,
    isOwner
};
