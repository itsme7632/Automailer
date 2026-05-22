import { Router, type IRouter } from "express";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const COLUMN_ALIASES: Record<string, string> = {
  "name": "name", "full name": "name", "contact name": "name", "first name": "name",
  "email": "email", "email address": "email", "e-mail": "email",
  "vehicle": "vehicle", "car": "vehicle", "auto": "vehicle", "make": "vehicle", "model": "vehicle",
  "route": "route", "shipping route": "route",
  "pickup": "pickup", "origin": "pickup", "from": "pickup", "pickup location": "pickup",
  "delivery": "delivery", "destination": "delivery", "to": "delivery", "delivery location": "delivery",
  "price": "price", "rate": "price", "cost": "price", "quote": "price", "amount": "price",
  "notes": "notes", "note": "notes", "comments": "notes", "additional info": "notes",
};

function detectColumn(header: string): string | null {
  const lower = header.toLowerCase().trim();
  return COLUMN_ALIASES[lower] ?? null;
}

function mapRow(headers: string[], row: Record<string, string>): Record<string, string | null> {
  const mapped: Record<string, string | null> = {
    name: null, email: null, vehicle: null, route: null,
    pickup: null, delivery: null, price: null, notes: null,
  };
  for (const header of headers) {
    const field = detectColumn(header);
    if (field && row[header]) {
      mapped[field] = row[header];
    }
  }
  return mapped;
}

router.post("/uploads/parse", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const filename = req.file.originalname.toLowerCase();
  let rows: Record<string, string>[] = [];
  let headers: string[] = [];

  try {
    if (filename.endsWith(".csv")) {
      const text = req.file.buffer.toString("utf-8");
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      headers = result.meta.fields ?? [];
      rows = result.data;
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      if (data.length > 0) headers = Object.keys(data[0]);
      rows = data;
    } else {
      res.status(400).json({ error: "Unsupported file format. Please upload CSV or XLSX." });
      return;
    }
  } catch (err) {
    res.status(400).json({ error: "Failed to parse file" });
    return;
  }

  const seenEmails = new Set<string>();
  const parsedRows = rows.map(row => {
    const mapped = mapRow(headers, row);
    const hasValidEmail = !!(mapped.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email));
    const isDuplicate = hasValidEmail && seenEmails.has(mapped.email!.toLowerCase());
    if (hasValidEmail) seenEmails.add(mapped.email!.toLowerCase());
    return { ...mapped, hasValidEmail, isDuplicate };
  });

  const validRows = parsedRows.filter(r => r.hasValidEmail && !r.isDuplicate).length;
  const invalidRows = parsedRows.filter(r => !r.hasValidEmail).length;
  const duplicateRows = parsedRows.filter(r => r.isDuplicate).length;
  const detectedColumns = headers.map(h => detectColumn(h)).filter(Boolean) as string[];

  res.json({
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    duplicateRows,
    detectedColumns: [...new Set(detectedColumns)],
  });
});

export default router;
