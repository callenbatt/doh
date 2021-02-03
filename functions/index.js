const functions = require("firebase-functions");
const app = require("express")();
const { dns, createDNSDoc } = require("./controllers/dns");
const respondWithHello = (req, res) => {
  res.json({ message: "hello" });
};

app.get("/hello", respondWithHello);
app.get("/dns", dns);
app.post("/dns/create", createDNSDoc);

exports.api = functions.https.onRequest(app);
