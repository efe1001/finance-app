const admin = require('firebase-admin');

let app = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  app = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  });
}

// Best-effort: push notifications are a UX nicety, never worth failing the
// underlying admin action (approve/reject/etc) over.
async function sendPush(fcmToken, title, body) {
  if (!app || !fcmToken) return;
  try {
    await admin.messaging().send({ token: fcmToken, notification: { title, body } });
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }
}

module.exports = { sendPush };
