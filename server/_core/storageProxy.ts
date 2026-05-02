import type { Express } from "express";
import { getStoredFile } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/api/files/*", (req, res) => {
    const key = decodeURIComponent((req.params as Record<string, string>)["0"] ?? "");
    if (!key) {
      res.status(400).send("Missing file key");
      return;
    }

    const file = getStoredFile(key);
    if (!file) {
      res.status(404).send("File not found or expired");
      return;
    }

    res.set("Content-Type", file.contentType);
    res.set("Cache-Control", "no-store");
    res.send(file.data);
  });
}
