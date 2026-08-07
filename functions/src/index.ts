import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Runs every 5 minutes — marks IN_PROGRESS pong games as FINISHED
// when the host hasn't written a heartbeat in the last 60 seconds.
export const cleanupStalePongGames = functions.scheduler.onSchedule(
  { schedule: "every 5 minutes", timeoutSeconds: 60 },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60_000);
    const snap = await db
      .collection("pongGames")
      .where("status", "==", "IN_PROGRESS")
      .where("lastHeartbeat", "<", cutoff)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "FINISHED",
        abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`Cleaned up ${snap.size} stale pong game(s).`);
  }
);
