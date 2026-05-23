import { Router, type IRouter } from "express";
import multer from "multer";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Extended column aliases — covers common vehicle shipping CSV formats
const COLUMN_ALIASES: Record<string, string> = {
  // Name
  "name": "name",
  "full name": "name",
  "fullname": "name",
  "contact name": "name",
  "contact": "name",
  "first name": "name",
  "firstname": "name",
  "customer name": "name",
  "client name": "name",
  "customer": "name",
  "client": "name",

  // Email
  "email": "email",
  "email address": "email",
  "emailaddress": "email",
  "e-mail": "email",
  "e_mail": "email",
  "mail": "email",

  // Vehicle — must contain text, not just a number
  "vehicle": "vehicle",
  "vehicle type": "vehicle",
  "vehicle_type": "vehicle",
  "vehicletype": "vehicle",
  "car": "vehicle",
  "car type": "vehicle",
  "car_type": "vehicle",
  "auto": "vehicle",
  "automobile": "vehicle",
  "make": "vehicle",
  "model": "vehicle",
  "make/model": "vehicle",
  "make_model": "vehicle",
  "makemodel": "vehicle",
  "year make model": "vehicle",
  "year_make_model": "vehicle",
  "transport vehicle": "vehicle",
  "transport_vehicle": "vehicle",
  "transportvehicle": "vehicle",
  "vehicle description": "vehicle",
  "vehicle_description": "vehicle",
  "yr/make/model": "vehicle",
  "ymm": "vehicle",

  // Route
  "route": "route",
  "shipping route": "route",
  "shipping_route": "route",

  // Pickup
  "pickup": "pickup",
  "pick up": "pickup",
  "pick_up": "pickup",
  "origin": "pickup",
  "from": "pickup",
  "from location": "pickup",
  "from_location": "pickup",
  "pickup location": "pickup",
  "pickup_location": "pickup",
  "shipping from": "pickup",
  "ship from": "pickup",
  "shipper city": "pickup",
  "pickup city": "pickup",
  "origin city": "pickup",

  // Delivery
  "delivery": "delivery",
  "destination": "delivery",
  "to": "delivery",
  "to location": "delivery",
  "to_location": "delivery",
  "delivery location": "delivery",
  "delivery_location": "delivery",
  "shipping to": "delivery",
  "ship to": "delivery",
  "consignee city": "delivery",
  "delivery city": "delivery",
  "destination city": "delivery",

  // Price
  "price": "price",
  "rate": "price",
  "cost": "price",
  "quote": "price",
  "amount": "price",
  "shipping cost": "price",
  "shipping_cost": "price",
  "shipping rate": "price",
  "shipping_rate": "price",
  "transport cost": "price",
  "transport_cost": "price",
  "transport price": "price",
  "transport_price": "price",
  "total": "price",
  "fee": "price",
  "bid": "price",
  "offer": "price",

  // Company
  "company": "company",
  "company name": "company",
  "business": "company",
  "broker": "company",
  "broker name": "company",

  // Phone
  "phone": "phone",
  "phone number": "phone",
  "telephone": "phone",
  "mobile": "phone",
  "cell": "phone",

  // Notes
  "notes": "notes",
  "note": "notes",
  "comments": "notes",
  "comment": "notes",
  "additional info": "notes",
  "additional_info": "notes",
  "remarks": "notes",
  "details": "notes",
  "extra": "notes",
};

function detectColumn(header: string): string | null {
  const lower = header.toLowerCase().trim();
  if (COLUMN_ALIASES[lower]) return COLUMN_ALIASES[lower];
  for (const [alias, field] of Object.entries(COLUMN_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return field;
    }
  }
  return null;
}

/**
 * Returns true only if this value looks like a real vehicle description.
 * Rejects purely numeric values (e.g., "425") which are prices, not vehicles.
 */
function isValidVehicleValue(val: string): boolean {
  const trimmed = val.trim();
  // Purely numeric (with optional $ or commas) → NOT a vehicle
  if (/^\$?[\d,]+\.?\d*$/.test(trimmed)) return false;
  // Very short single tokens that are all digits → not a vehicle
  if (/^\d+$/.test(trimmed)) return false;
  return trimmed.length > 0;
}

/**
 * Returns true if a value looks like a currency / numeric amount.
 * Used as a hint when we need to prefer "price" mapping over others.
 */
function looksLikePrice(val: string): boolean {
  return /^\$?[\d,]+\.?\d*$/.test(val.trim());
}

function mapRow(headers: string[], row: Record<string, string>): Record<string, string | null> {
  const mapped: Record<string, string | null> = {
    name: null, email: null, vehicle: null, route: null,
    pickup: null, delivery: null, price: null, notes: null,
    company: null, phone: null,
  };

  for (const header of headers) {
    const field = detectColumn(header);
    if (!field) continue;
    if (mapped[field]) continue; // already filled by an earlier column

    const val = String(row[header] ?? "").trim();
    if (!val) continue;

    // Validation gates
    if (field === "vehicle" && !isValidVehicleValue(val)) continue;

    // If a column is mapped to a non-price field but has a numeric value,
    // try reassigning it to price if price is still empty.
    if (field !== "price" && field !== "email" && field !== "phone" && looksLikePrice(val)) {
      if (!mapped["price"]) {
        mapped["price"] = val;
      }
      continue;
    }

    mapped[field] = val;
  }

  return mapped;
}

/** Normalize a CSV header to a valid template variable name, e.g. "Transport Type" → "transport_type" */
function normalizeKey(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
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
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
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
  } catch {
    res.status(400).json({ error: "Failed to parse file. Make sure it is a valid CSV or XLSX." });
    return;
  }

  const seenEmails = new Set<string>();
  const parsedRows = rows.map(row => {
    const mapped = mapRow(headers, row);
    const hasValidEmail = !!(mapped.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email));
    const isDuplicate = hasValidEmail && seenEmails.has(mapped.email!.toLowerCase());
    if (hasValidEmail) seenEmails.add(mapped.email!.toLowerCase());

    // Include all raw column values (normalized to snake_case) so ANY column is usable as {variable}
    const rawFields: Record<string, string> = {};
    for (const header of headers) {
      const key = normalizeKey(header);
      if (key && row[header]) {
        rawFields[key] = String(row[header]).trim();
      }
    }

    // Mapped standard fields take precedence over raw fields
    const mergedRow: Record<string, string | null | boolean> = { ...rawFields, ...mapped, hasValidEmail, isDuplicate };
    return mergedRow;
  });

  const validRows = parsedRows.filter(r => r.hasValidEmail && !r.isDuplicate).length;
  const invalidRows = parsedRows.filter(r => !r.hasValidEmail).length;
  const duplicateRows = parsedRows.filter(r => r.isDuplicate).length;

  const columnMappings: Record<string, string> = {};
  for (const h of headers) {
    const field = detectColumn(h);
    if (field) columnMappings[h] = field;
  }
  const detectedColumns = [...new Set(Object.values(columnMappings))];
  const unmappedColumns = headers.filter(h => !columnMappings[h]);

  res.json({
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    duplicateRows,
    detectedColumns,
    columnMappings,
    unmappedColumns,
    headers,
  });
});

export default router;
