import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS-free Server-Side Proxy for Google Gmail API
  app.post("/api/gmail/messages", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, q, maxResults = 15 } = req.body;

      if (!token) {
        res.status(400).json({ error: "Missing googleAccessToken for Gmail Live scan." });
        return;
      }

      // Query Gmail messages matching the query
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q || "")}&maxResults=${maxResults}`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!searchRes.ok) {
        res.status(searchRes.status).json({
          error: `Gmail API search returned error status ${searchRes.status}.`
        });
        return;
      }

      const listData = await searchRes.json() as { messages?: { id: string }[] };
      if (!listData.messages || listData.messages.length === 0) {
        res.json({ messages: [] });
        return;
      }

      // Fetch detail for each message in parallel on the server
      const detailedMessages = await Promise.all(
        listData.messages.map(async (msg) => {
          try {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!detailRes.ok) return null;
            return await detailRes.json();
          } catch (e) {
            console.error(`Error fetching message detail for ID ${msg.id}:`, e);
            return null;
          }
        })
      );

      // Filter out any null responses
      const messages = detailedMessages.filter(m => m !== null);
      res.json({ messages });
    } catch (error: any) {
      console.error("Gmail proxy side-channel error:", error);
      res.status(500).json({ error: error.message || "An issue occurred on the proxy server connecting to Gmail API." });
    }
  });

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RentMaster Pro fullstack server listening on http://localhost:${PORT}`);
  });
}

startServer();
