# Connecting Centrum to Telegram (Owner & Staff)

This guide is for the venue owner and staff — no technical background needed.
Everything takes about **10 minutes** and you only do it once.

---

## What is this?

Your venue manager website (bookings, payments, reports) also works through
Telegram. You and your staff can ask for a schedule, record a booking, or
check the day's income by simply chatting with a bot.

## What you need

- A Telegram account (free, on your phone or computer).
- The person who set up your website gives you the bot, OR you create it
  yourself with step 1 below.

## If we created the bot for you

1. Open Telegram and find the bot by its username (we will give it to you).
2. Press **Start**.
3. Send a message like `halo` — the bot should answer.
4. That's it. You can now use it.

## If you want to create the bot yourself (only needed when we ask you to)

1. Open Telegram, search for **@BotFather** (blue checkmark).
2. Press Start, then send `/newbot`.
3. Give it a name (example: `Centrum Owner`).
4. Give it a username that ends in `bot` (example: `centrum_owner_bot`).
5. BotFather sends you a **token** — a long code like `123456789:AAH...`.
6. Copy the token and give it to whoever manages the AgentsProxy backend.
   The token is **not** stored in the frontend — never paste it into a
   settings page or a repo file.
7. Send the bot a message and press **Start**.

## Give the right people access (important for money questions)

- The **Owner bot** can answer money and report questions.
- The **Staff bot** can help with schedule and daily income.
- Only chats you put on the **allow list** (managed in AgentsProxy) can use
  Owner/Staff bots. Everyone else is politely refused. Ask your backend
  administrator to add chat IDs.

### How to find your Telegram chat ID

1. Open Telegram and search for **@userinfobot**.
2. Press Start. It replies with a number — that is your chat ID.
3. Copy that number into the allow list.

## What the bot can do (examples)

- `jam kosong besok jam 19?` → shows free slots
- `catat booking Lapangan 1 besok 19-20 atas nama Budi` → books it
- `berapa pemasukan hari ini?` → shows today's income
- `buatkan laporan excel bulan ini` → sends you an Excel file

## What if something goes wrong?

| Problem | What to do |
| --- | --- |
| Bot does not answer | Check the bot is started (press Start). Try again after 1 minute. |
| "You are not allowed" | Your chat ID is not on the allow list. Ask the owner to add it. |
| Wrong answers | Say `mulai ulang` to reset the conversation, then ask again. |
| Bot stopped forever | Contact the person who manages your website (you cannot fix this alone). |

## Security reminders

- The **token is like a key**. Never share it with anyone except the person
  setting up your website. If you think it leaked: in @BotFather press
  `/revoke`, choose the bot — the old key stops working immediately and a
  new one is issued. Give the new token to the backend administrator.
- Money questions are only answered through the Owner bot, and only for
  chats you allowed.

---
*Questions? Ask the person who set up your website.*
