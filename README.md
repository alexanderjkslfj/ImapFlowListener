# ImapFlowListener

Library for continuously listening for new emails using IMAP.

Uses [ImapFlow](https://www.npmjs.com/package/imapflow) as a dependency.

### Usage
```javascript
import { onMail } from "./imapFlowListener.mjs";

onMail({
    host: "host.com",
    username: "myusername",
    password: "mypassword"
}, (envelope, bodyParts) => {
    console.log(`I just received an email with ${envelope.subject} as the subject!`)
    if(bodyParts.length !== 0) console.log("The first body part of this mail reads as follows:", bodyParts[0]);
})
```

### Documentation

```typescript
onMail(
  auth: {
    host: string,
    username: string,
    password: string
  },
  callback: (envelope: MessageEnvelopeObject, bodyParts: string[]) => any,
  refreshDelay: number = 1000
)
```

The only function this module exports is **onMail**. The function takes three parameters: **auth**, **callback** and **refreshDelay**

onMail connects to an imap server using the login information provided in the **auth** parameter.

When connected, it continuously pulls new emails. The amount of milliseconds to wait between two pulls are provided in the **refreshDelay** parameter.

Whenever a new mail is received, it is marked as seen and its contents are passed to the callback given in the **callback** parameter.

#### auth

An object containing the login information for the imap server to be accessed. It contains the *host*, *username* and *password*.

#### callback

The callback to be called every time a new email is received. A [MessageEnvelopeObject](https://imapflow.com/global.html#MessageEnvelopeObject) containing the metadata of the email and an array of strings containing the decoded body parts is passed.

#### refreshDelay

The number of milliseconds to wait in between pulling new emails. Defaults to 1000.
