# Two-node federation demo

Build once with `npm run build`. Start each node in a separate terminal from
this checkout, with different persistent database directories and node IDs:

```sh
PARAREPORT_NODE_ID=node-a PARAREPORT_NODE_SECRET=local-demo-secret \
PARAREPORT_PEERS=http://127.0.0.1:3002 PARAREPORT_DATA_DIR=./data/node-a \
PARAREPORT_SEED=false npm run start -- --hostname 127.0.0.1 --port 3001
```

```sh
PARAREPORT_NODE_ID=node-b PARAREPORT_NODE_SECRET=local-demo-secret \
PARAREPORT_PEERS=http://127.0.0.1:3001 PARAREPORT_DATA_DIR=./data/node-b \
PARAREPORT_SEED=false npm run start -- --hostname 127.0.0.1 --port 3002
```

1. Create a synthetic report at http://localhost:3001.
2. At http://localhost:3002/dashboard, select **Check node**, then **Sync peers**.
3. Open the received report in node B's issue feed. It names node A as origin.
4. Mark the original fixed on A; sync B again and show the updated status.
5. Sync again: unchanged snapshots do not create duplicate reports.
6. Stop A and sync B: the error is visible and B's existing reports remain usable.

Sample reports are excluded even when seeding is enabled. Imported receipts
are read-only on a receiving node; status changes happen at the origin. Photos
and fixed-proof uploads stay local. Only the public receipt and structured
location/status metadata are exchanged. Do not use sensitive text in this demo.

## Protocol used by this prototype

A local SQLite change journal assigns monotonically increasing sequences to
report insertions and later updates. The feed publishes the latest snapshot
per changed report, ordered by sequence, with an opaque `s:<sequence>` cursor.
Each page has at most 200 receipts and approximately 1.5 MB of signed content.
A pull handles at most 20 pages, persisting progress between pages; the interface
asks for another sync if more remain. This is snapshot replication, not an
append-only audit of every intermediate state.

Snapshots use HMAC-SHA256. Import validates the complete shape and signature,
rejects self imports, namespaces remote IDs, and applies only newer origin
snapshots. Origin mutations advance updatedAt even within the same millisecond.
An invalid batch does not advance the peer cursor. Receipts already accepted
from a mixed page remain stored and are deduplicated on retry.

Upgrade both nodes together: timestamp cursors from the old prototype are
cleared on database startup. Existing reports are backfilled into the sequence
journal. The payload envelope remains version 1, but the sequence feed requires
both nodes to run this revision. Do not restore one peer's database to an older
sequence stream without also resetting the receiving node's peer cursor.

The mesh secret is shared: any trusted participant can impersonate another
node. Signatures establish shared-secret provenance, not truth or independent
identity. Membership, per-node public keys, deletions, redaction, arbitrary
multi-hop forwarding and conflict review are outside this small demo.
