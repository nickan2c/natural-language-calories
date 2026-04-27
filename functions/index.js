const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

const notionToken = defineString("NOTION_TOKEN");

exports.notionProxy = onRequest({ cors: true }, async (req, res) => {
  const path = req.query.path;
  if (!path) {
    res.status(400).json({ error: "Missing path parameter" });
    return;
  }

  const notionRes = await fetch(`https://api.notion.com${path}`, {
    method: req.method,
    headers: {
      "Authorization": `Bearer ${notionToken.value()}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });

  const data = await notionRes.json();
  res.status(notionRes.status).json(data);
});
