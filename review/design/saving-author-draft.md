# Saving on a bad connection: the author's draft, written before seeing the peers' designs

## The question
Parents use the app on phones at tournaments, often with a bad signal. A save can reach the server while its reply never makes it back, so the phone can't tell whether it worked. Today each kind of save handles this its own way, and three rounds of fixes kept opening new holes. What's a design that makes this simple and safe?

## Draft: an outbox on the phone, a ledger on the server

**The phone has one outbox.** Every add (expense, person, family, coach, trip) goes into the outbox before it's sent: what it is, where it goes, a key made for it, and what was typed. The outbox is kept on the phone and survives closing the app. An entry leaves the outbox only when the app gives a real answer: a readable reply from the app saying it worked, or a clear refusal. Anything else (no reply, half a reply, an error page from the network, the server's own crash message) means "don't know yet", and the entry stays.

**Unsure entries are visible.** The screen shows an unsure entry as "not confirmed yet", with two choices: send it again (same key, so it can't be added twice) or discard it. Discarding checks with the server first, so a saved one isn't silently left behind. A new add of the same kind, in the same place, waits until the older unsure one is settled.

**The server has a ledger of keys.** Every key the server has handled is written down with what it made, in the same step as making it. A key that comes again gets back what it made, unchanged. The server never changes anything because of a repeated key. If what was sent the second time differs from what's stored, the reply says so, and the phone shows the difference ("your first save went through as $24.10; you typed $42.10") and lets the parent fix it as a normal edit. If the thing a key made has since been deleted, the ledger remembers that, and the reply says so.

**Edits and deletes stay as they are** (they already check the version they started from), at least for now.

## What it costs parents
Nothing when the signal is fine. On a bad signal: a "not confirmed yet" label, and sometimes a tap to resend.

## What it doesn't handle
Two parents on two phones entering the same bill.
