const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const {
    handleCommand,
    getGroup,
    isGroup
} = require("./commands");

const config = require("./config");

const pino = require("pino");
const qrcode = require("qrcode-terminal");


async function startBot() {

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(
        "./auth"
    );


    const sock =
        makeWASocket({

            auth: state,

            logger:
                pino({
                    level: "silent"
                }),

            printQRInTerminal: false
        });


    // =====================================
    // LOGIN DATEN SPEICHERN
    // =====================================

    sock.ev.on(
        "creds.update",
        saveCreds
    );


    // =====================================
    // VERBINDUNG
    // =====================================

    sock.ev.on(
        "connection.update",
        async update => {

            const {
                connection,
                lastDisconnect,
                qr
            } = update;


            if (qr) {

                console.log(
                    "\n📱 Scanne diesen QR-Code mit WhatsApp:\n"
                );

                qrcode.generate(
                    qr,
                    {
                        small: true
                    }
                );
            }


            if (connection === "open") {

                console.log(
                    "================================"
                );

                console.log(
                    "🤖 BOT IST ONLINE!"
                );

                console.log(
                    `📛 ${config.botName}`
                );

                console.log(
                    "================================"
                );
            }


            if (connection === "close") {

                const status =
                    lastDisconnect
                        ?.error
                        ?.output
                        ?.statusCode;


                if (
                    status ===
                    DisconnectReason.loggedOut
                ) {

                    console.log(
                        "❌ WhatsApp hat den Bot ausgeloggt."
                    );

                    return;
                }


                console.log(
                    "⚠️ Verbindung verloren."
                );

                console.log(
                    "🔄 Neuer Verbindungsversuch..."
                );

                setTimeout(
                    startBot,
                    3000
                );
            }
        }
    );


    // =====================================
    // NACHRICHTEN
    // =====================================

    sock.ev.on(
        "messages.upsert",
        async ({ messages }) => {

            try {

                const message =
                    messages[0];

                if (!message) return;

                if (!message.message) return;

                if (message.key.fromMe) return;


                const jid =
                    message.key.remoteJid;

                if (!jid) return;


                const sender =
                    message.key.participant ||
                    jid;


                const text =
                    message.message.conversation ||
                    message.message.extendedTextMessage
                        ?.text ||
                    message.message.imageMessage
                        ?.caption ||
                    "";


                if (!text) return;


                // =====================================
                // ANTI-LINK AUTOMATISCH
                // =====================================

                if (
                    isGroup(jid)
                ) {

                    await handleAutomaticAntiLink(
                        sock,
                        message,
                        jid,
                        sender,
                        text
                    );
                }


                // =====================================
                // PREFIX
                // =====================================

                if (
                    !text.startsWith(
                        config.prefix
                    )
                ) {

                    return;
                }


                const withoutPrefix =
                    text
                        .slice(
                            config.prefix.length
                        )
                        .trim();


                if (!withoutPrefix) return;


                const parts =
                    withoutPrefix.split(
                        /\s+/
                    );


                const command =
                    parts
                        .shift()
                        .toLowerCase();


                const args =
                    parts;


                await handleCommand(
                    sock,
                    message,
                    jid,
                    sender,
                    command,
                    args,
                    text
                );


            } catch (error) {

                console.error(
                    "❌ Nachrichtenfehler:",
                    error
                );
            }
        }
    );
}


// =========================================
// AUTOMATISCHER ANTI-LINK
// =========================================

async function handleAutomaticAntiLink(
    sock,
    message,
    jid,
    sender,
    text
) {

    const group =
        getGroup(jid);


    if (!group.antiLink) {
        return;
    }


    const urlRegex =
        /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|tiktok\.com|instagram\.com)/i;


    if (!urlRegex.test(text)) {
        return;
    }


    // Admins dürfen weiterhin Links schicken
    try {

        const metadata =
            await sock.groupMetadata(jid);

        const participant =
            metadata.participants.find(
                p => p.id === sender
            );

        const admin =
            participant &&
            (
                participant.admin === "admin" ||
                participant.admin === "superadmin"
            );

        if (admin) {
            return;
        }

    } catch (error) {

        console.error(
            "Anti-Link Adminprüfung:",
            error
        );
    }


    try {

        await sock.sendMessage(
            jid,
            {
                delete: message.key
            }
        );

        await sock.sendMessage(
            jid,
            {
                text:
                    "🚫 Link entfernt!\n\n" +
                    "Links sind in dieser Gruppe nicht erlaubt."
            }
        );

    } catch (error) {

        console.error(
            "❌ Link konnte nicht gelöscht werden:",
            error
        );
    }
}


startBot();
