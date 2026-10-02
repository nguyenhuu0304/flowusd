"use client";

import { useEffect, useState } from "react";
import {
  DIRECTORY_CHANGED_EVENT,
  TELEGRAM_API_BASE,
  clearTelegramToken,
  getTelegramToken,
  saveTelegramToken,
  telegramApi,
  syncBill,
  getContacts,
  type DirectoryContact,
} from "@/lib/telegramDirectory";
import { toast } from "sonner";
import { Copy, ExternalLink, Send, ShieldCheck } from "lucide-react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { BATCH_CONTRACT_ADDRESS } from "@/lib/web3/batchPaymentLinks";

const BASE = TELEGRAM_API_BASE;

const TELEGRAM_BOT_USERNAME =
  process.env.NEXT_PUBLIC_FLOWUSD_TELEGRAM_BOT_USERNAME ||
  "FlowUSD_Telegram_Phase1_bot";

const MEMBER_INVITE_URL =
  `https://t.me/${TELEGRAM_BOT_USERNAME}?start=register`;

const MEMBER_SHARE_URL =
  `https://t.me/share/url?url=${encodeURIComponent(MEMBER_INVITE_URL)}` +
  `&text=${encodeURIComponent(
    "Join my FlowUSD Member Directory. Open the FlowUSD bot, then send /register and share the one-time code with me."
  )}`;

type Member = {
  id: string;
  name: string;
  raw: string;
  directoryId?: string | null;
};

type Bill = {
  id: string;
  title: string;
  creator: string;
  totalRaw: string;
  txHash: string;
  stage: string;
  members: Member[];
};

function savedBills(owner: string): Bill[] {
  const key =
    `flowusd:batch-bills:v1:` +
    `${BATCH_CONTRACT_ADDRESS.toLowerCase()}:` +
    `${owner.toLowerCase()}`;

  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (bill): bill is Bill =>
        Boolean(
          bill &&
            typeof bill === "object" &&
            bill.creator?.toLowerCase() === owner.toLowerCase() &&
            bill.stage === "confirmed" &&
            /^0x[0-9a-f]{64}$/i.test(bill.txHash) &&
            Array.isArray(bill.members)
        )
    );
  } catch {
    return [];
  }
}

export default function TelegramSyncCard() {
  const wallet = useWeb3Wallet();

  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(0);

  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [enrollCode, setEnrollCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [directoryBusy, setDirectoryBusy] = useState(false);

  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editFull, setEditFull] = useState("");

  const connected =
    !!wallet.address &&
    !!getTelegramToken(wallet.address);

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(MEMBER_INVITE_URL);
      toast.success("Telegram member invite link copied");
    } catch {
      toast.error("Could not copy invite link");
    }
  }

  async function saveContact() {
    const owner = wallet.address;

    if (
      !owner ||
      !editingId ||
      !getTelegramToken(owner) ||
      !editName.trim()
    ) {
      return;
    }

    setDirectoryBusy(true);

    try {
      await telegramApi(
        `/api/directory/${encodeURIComponent(editingId)}`,
        "PATCH",
        {
          displayName: editName.trim(),
          fullName: editFull.trim(),
        },
        getTelegramToken(owner)
      );

      setEditingId("");
      await reloadDirectory();
      toast.success("Member name updated");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setDirectoryBusy(false);
    }
  }

  async function reloadDirectory() {
    if (!wallet.address) {
      return;
    }

    try {
      const list = await getContacts(wallet.address);
      setContacts(list);

      window.dispatchEvent(
        new Event(DIRECTORY_CHANGED_EVENT)
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : String(error);

      setStatus(text);

      if (/401|expired/i.test(text)) {
        clearTelegramToken(wallet.address);
        setToken("");
      }
    }
  }

  async function addContact() {
    const owner = wallet.address;

    if (
      !owner ||
      !getTelegramToken(owner) ||
      !enrollCode.trim() ||
      !displayName.trim()
    ) {
      return;
    }

    setDirectoryBusy(true);

    try {
      await telegramApi(
        "/api/directory",
        "POST",
        {
          code: enrollCode.trim(),
          displayName: displayName.trim(),
          fullName: fullName.trim(),
        },
        getTelegramToken(owner)
      );

      setEnrollCode("");
      setDisplayName("");
      setFullName("");

      setStatus(
        "Member registered! Choose them when creating the next bill."
      );

      toast.success("Member added to directory");

      await reloadDirectory();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error)
      );

      toast.error("Could not register member");
    } finally {
      setDirectoryBusy(false);
    }
  }

  useEffect(() => {
    setToken(
      wallet.address
        ? getTelegramToken(wallet.address)
        : ""
    );

    setStatus("");
    setContacts([]);

    if (
      wallet.address &&
      getTelegramToken(wallet.address)
    ) {
      void reloadDirectory();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.address]);

  async function renewSession() {
    const owner = wallet.address;

    if (
      !owner ||
      !wallet.provider ||
      !wallet.isOnArcTestnet
    ) {
      return;
    }

    setBusy(true);

    try {
      const challenge = await telegramApi(
        "/api/owner/challenge",
        "POST",
        { wallet: owner }
      );

      const signature =
        await wallet.provider.request({
          method: "personal_sign",
          params: [
            challenge.message,
            owner,
          ],
        });

      if (typeof signature !== "string") {
        throw new Error(
          "Wallet returned no signature"
        );
      }

      const result = await telegramApi(
        "/api/owner/connect",
        "POST",
        {
          wallet: owner,
          nonce: challenge.nonce,
          signature,
        }
      );

      saveTelegramToken(
        owner,
        result.accessToken,
        result.expiresIn
      );

      setToken(result.accessToken);

      setStatus(
        "Wallet session renewed. Registered members remain saved; no Telegram re-registration needed."
      );

      await reloadDirectory();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (
      !BASE ||
      !wallet.provider ||
      !wallet.address ||
      !wallet.isOnArcTestnet ||
      !code.trim()
    ) {
      return;
    }

    setBusy(true);

    try {
      const address = wallet.address;

      const challenge = await telegramApi(
        "/api/challenge",
        "POST",
        {
          wallet: address,
          code: code.trim(),
        }
      );

      const signature =
        await wallet.provider.request({
          method: "personal_sign",
          params: [
            challenge.message,
            address,
          ],
        });

      if (typeof signature !== "string") {
        throw new Error(
          "Wallet returned no signature"
        );
      }

      const result = await telegramApi(
        "/api/connect",
        "POST",
        {
          wallet: address,
          code: code.trim(),
          nonce: challenge.nonce,
          signature,
        }
      );

      saveTelegramToken(
        address,
        result.accessToken,
        result.expiresIn
      );

      setToken(result.accessToken);
      setCode("");

      await reloadDirectory();

      setStatus(
        "Telegram linked! Confirmed Batch bills can now sync to Telegram."
      );

      toast.success("Telegram wallet linked");
    } catch (error) {
      const err =
        error instanceof Error
          ? error.message
          : String(error);

      setStatus(err);
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function syncAll() {
    if (
      !wallet.address ||
      !getTelegramToken(wallet.address) ||
      busy
    ) {
      return;
    }

    setBusy(true);

    const bills = savedBills(wallet.address);

    let ok = 0;
    let fails = 0;

    try {
      if (!bills.length) {
        setStatus(
          "No confirmed local Batch bills found for this wallet."
        );
        return;
      }

      for (
        let index = 0;
        index < bills.length;
        index++
      ) {
        setStatus(
          `Syncing ${index + 1}/${bills.length}: ${bills[index].title}`
        );

        try {
          await syncBill(
            wallet.address,
            bills[index]
          );

          ok++;
        } catch (error) {
          fails++;

          setStatus(
            `Error on ${bills[index].title}: ${
              error instanceof Error
                ? error.message
                : String(error)
            }`
          );

          if (
            error instanceof Error &&
            /Reconnect|401/.test(
              error.message
            )
          ) {
            break;
          }
        }
      }

      setCount(ok);

      if (!fails) {
        setStatus(
          `Synced ${ok} confirmed bills. Telegram-linked members can receive payment requests and paid confirmations.`
        );

        toast.success(
          `${ok} bills synced`
        );
      } else {
        setStatus(
          `Synced ${ok}, failed ${fails}. Older invalid bills can be reviewed separately.`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Send size={18} />
        Telegram Payment Monitor — Phase 1
      </h3>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Pair Telegram with this wallet, register members once,
        and sync confirmed Batch bills. Registered members can
        receive a payment request when a bill is assigned to them
        and a confirmation after payment.
      </p>

      {!BASE ? (
        <p className="mt-3 text-sm text-amber-600">
          Set NEXT_PUBLIC_FLOWUSD_BOT_API_URL in .env.local and
          restart Next.js.
        </p>
      ) : (
        <>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <li>
              Open the FlowUSD Telegram bot, send /start then
              /connect in private chat.
            </li>
            <li>
              Paste the pairing code below, click Link Telegram
              and sign the message in Rabby.
            </li>
            <li>
              Invite members with the Telegram invite link below.
              Each member sends /register and gives you their
              one-time registration code.
            </li>
            <li>
              Confirmed Batch bills auto-sync after creation when
              your Telegram session is active. Sync All can retry
              older confirmed bills.
            </li>
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={code}
              onChange={event =>
                setCode(event.target.value)
              }
              placeholder="One-time /connect code"
              autoComplete="off"
              aria-label="Telegram pairing code"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />

            <button
              type="button"
              onClick={() =>
                void connect()
              }
              disabled={
                busy ||
                !wallet.address ||
                !wallet.provider ||
                !wallet.isOnArcTestnet ||
                !code.trim()
              }
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Link Telegram
            </button>

            <button
              type="button"
              onClick={() =>
                void renewSession()
              }
              disabled={
                busy ||
                !wallet.address ||
                !wallet.provider ||
                !wallet.isOnArcTestnet
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Renew wallet session
            </button>

            <button
              type="button"
              onClick={() =>
                void syncAll()
              }
              disabled={
                busy ||
                !connected
              }
              className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-600 disabled:opacity-50"
            >
              Sync All
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <h4 className="text-sm font-semibold">
              Member Directory — register once, use for every bill
            </h4>

            <p className="mt-1 text-xs text-slate-500">
              Invite a member to the FlowUSD Telegram bot. They
              send /register and privately give you the one-time
              registration code. Only you can add contacts to
              your directory.
            </p>

            <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs font-semibold">
                Invite member via Telegram
              </p>

              <p className="mt-1 break-all text-xs text-slate-500">
                {MEMBER_INVITE_URL}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={MEMBER_SHARE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Send
                    size={14}
                    className="mr-1 inline"
                  />
                  Share invite
                </a>

                <a
                  href={MEMBER_INVITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"
                >
                  <ExternalLink
                    size={14}
                    className="mr-1 inline"
                  />
                  Open bot
                </a>

                <button
                  type="button"
                  onClick={() =>
                    void copyInviteLink()
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"
                >
                  <Copy
                    size={14}
                    className="mr-1 inline"
                  />
                  Copy invite link
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={enrollCode}
                onChange={event =>
                  setEnrollCode(
                    event.target.value
                  )
                }
                placeholder="Member /register code"
                aria-label="Member registration code"
                className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />

              <input
                value={displayName}
                onChange={event =>
                  setDisplayName(
                    event.target.value
                  )
                }
                placeholder="Display name (e.g. Huy)"
                aria-label="Display name"
                maxLength={60}
                className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />

              <input
                value={fullName}
                onChange={event =>
                  setFullName(
                    event.target.value
                  )
                }
                placeholder="Full name (optional)"
                aria-label="Full name"
                maxLength={120}
                className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />

              <button
                type="button"
                disabled={
                  !connected ||
                  directoryBusy ||
                  !enrollCode.trim() ||
                  !displayName.trim()
                }
                onClick={() =>
                  void addContact()
                }
                className="rounded-lg bg-emerald-600 p-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {directoryBusy
                  ? "Registering..."
                  : "Add member — one time"}
              </button>
            </div>

            <div className="mt-3 flex justify-between gap-2 text-xs">
              <span>
                Saved members:{" "}
                <strong>
                  {contacts.length}
                </strong>
              </span>

              <button
                type="button"
                disabled={!connected}
                onClick={() =>
                  void reloadDirectory()
                }
                className="text-blue-600 underline disabled:opacity-50"
              >
                Refresh directory
              </button>
            </div>

            {contacts.length > 0 && (
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {contacts.map(contact => (
                  <div
                    className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800"
                    key={contact.id}
                  >
                    {editingId === contact.id ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          aria-label="Update display name"
                          maxLength={60}
                          value={editName}
                          onChange={event =>
                            setEditName(
                              event.target.value
                            )
                          }
                          className="min-w-0 flex-1 rounded border p-1 dark:bg-slate-700"
                        />

                        <input
                          aria-label="Update full name"
                          maxLength={120}
                          value={editFull}
                          onChange={event =>
                            setEditFull(
                              event.target.value
                            )
                          }
                          className="min-w-0 flex-1 rounded border p-1 dark:bg-slate-700"
                        />

                        <button
                          type="button"
                          disabled={
                            directoryBusy ||
                            !editName.trim()
                          }
                          onClick={() =>
                            void saveContact()
                          }
                          className="text-emerald-600 underline disabled:opacity-50"
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setEditingId("")
                          }
                          className="underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-2">
                        <span>
                          <strong>
                            {contact.display_name}
                          </strong>

                          {contact.full_name
                            ? ` — ${contact.full_name}`
                            : ""}

                          {contact.username
                            ? ` (@${contact.username})`
                            : ""}
                        </span>

                        <button
                          type="button"
                          className="shrink-0 text-blue-600 underline"
                          onClick={() => {
                            setEditingId(
                              contact.id
                            );
                            setEditName(
                              contact.display_name
                            );
                            setEditFull(
                              contact.full_name ||
                                ""
                            );
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {status && (
            <p
              role="status"
              className="mt-3 break-words rounded-lg bg-slate-100 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            >
              {status}
            </p>
          )}

          {count > 0 && (
            <p className="mt-2 text-xs text-emerald-600">
              {count} bills linked to your wallet.
            </p>
          )}
        </>
      )}

      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <ShieldCheck size={14} />
        Telegram never receives wallet secrets. Messages are
        signed, not blockchain transactions.
      </p>
    </section>
  );
}
