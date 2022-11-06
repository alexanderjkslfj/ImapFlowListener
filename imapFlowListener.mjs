import { ImapFlow } from 'imapflow';

/**
 * Use IMAP to listen for new emails and mark them as seen once received.
 * Calls the callback once per mail.
 * Passes the envelope and an array of the body parts to the callback.
 * @param {{host:string,username:string,password:string}} auth login information of email client
 * @param {(envelope: import("imapflow").MessageEnvelopeObject, bodyParts: string[]) => any} callback called once per received mail
 * @param {number} refreshDelay delay in ms between email pulls
 * @returns {never} never
 */
export function onMail(auth, callback, refreshDelay = 1000) {
    // connect to mailserver
    connectMail(auth, async (client) => {
        const decoder = new TextDecoder()

        // pull new emails indefinetely
        while (true) {

            // new mails
            const messages = []

            // pull new mails
            for await (let message of client.fetch({
                new: true
            }, {
                uid: true,
                bodyStructure: true
            })) {
                const parts = []
                const encodings = []
                for (const childNode of message.bodyStructure.childNodes) {
                    parts.push(childNode.part)
                    encodings.push(childNode.encoding)
                }
                messages.push([message.uid, parts, encodings])
            }

            // process each mail and execute callback
            for (const message of messages) {

                // retrieve body
                const data = await client.fetchOne(message[0], {
                    bodyParts: message[1],
                    envelope: true
                }, {
                    uid: true
                })

                // mark mail as seen
                await client.messageFlagsAdd(message[0], ["\\Seen"], { uid: true })

                // decoded body parts
                const texts = []
                data.bodyParts.forEach((value, index) => {
                    texts.push(decoder.decode(Buffer.from(decoder.decode(value), getEncoding(message[2]?.[index] || "base64"))))
                })

                // execute callback, passing the envelope and decoded body parts
                callback(data.envelope, texts)
            }

            // wait the specified delay before pulling again
            await wait(refreshDelay)

        }
    })
}

/**
 * Use regex to extract an encoding string usable by Buffer.from from a given string
 * @param {string} string string to extract encoding from
 * @returns {string} encoding usable by Buffer.from - defaults to utf8
 */
function getEncoding(string) {
    if (string.match(/b.*64.*url/)) return "base64url"
    if (string.match(/b.*64/)) return "base64"
    if (string.match(/(ucs.*2)|(utf.*16)/)) return "utf16le"
    if (string.match(/utf.*8/)) return "utf8"
    if (string.match(/(binary)|(latin)/)) return "latin1"
    if (string.match(/ascii/)) return "ascii"
    console.warn("Unknown encoding:", string)
    return "utf8"
}

const AsyncFunction = (async () => { }).constructor
/**
 * Aquire mailbox lock, execute callback, then release mailbox lock. Exception safe.
 * @param {ImapFlow} client 
 * @param {(client: ImapFlow) => any} callback the mailclient is passed to the callback
 * @returns {Promise<void>} returns after callback finished
 */
async function withLock(client, callback) {
    let error = null

    // aquire lock
    const lock = await client.getMailboxLock("INBOX").catch(err => {
        error = `Aquiring lock failed: ${err}`
    })
    // throw if an error was encountered
    if (error !== null) throw error

    // different syntax for async functions
    if (callback instanceof AsyncFunction) {

        // execute callback
        await callback(client)
        // write error to error variable
            .catch(err => error = err)
        // release lock after execution
            .finally(() => lock.release())

    } else {

        try {
            // execute callback
            callback(client)
        } catch (err) {
            // write error to error variable
            error = err
        }
        // release lock after execution
        lock.release()

    }

    // throw if an error was encountered
    if (error !== null) throw error
}

/**
 * Connect to mailserver and aquire lock.
 * MailClient is passed to callback.
 * Automatically releases lock and logs out client after callback finishes.
 * @param {{host:string,username:string,password:string}} auth 
 * @param {(client: ImapFlow) => any} callback 
 * @returns {Promise<void>} returns after callback finished
 */
async function connectMail(auth, callback) {

    // create email client
    const client = new ImapFlow({
        host: auth.host,
        port: 993,
        secure: true,
        auth: {
            user: auth.username,
            pass: auth.password
        },
        emitLogs: false,
        logger: false
    });

    // connect to email server
    await client.connect().catch(err => {
        throw `Connection Failed: ${err.responseText}`
    })

    // aquire lock and execute callback
    await withLock(client, callback)

    await client.logout()

}

/**
 * Wait for the specified amount of time
 * @param {number} time the amount of milliseconds to wait
 * @returns {Promise<void>} returns when time has passed
 */
function wait(time) {
    return new Promise(res => setTimeout(res, time))
}
