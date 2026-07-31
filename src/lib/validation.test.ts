import { describe, it, expect } from "vitest";
import {
  absenceJustificationSchema,
  chatMessageSchema,
  localeSchema,
  themeSchema,
  uuidSchema,
  fileUploadSchema,
  ALLOWED_JUSTIFICATION_FILE_TYPES,
  MAX_JUSTIFICATION_FILE_SIZE,
} from "@/lib/validation";

describe("absenceJustificationSchema", () => {
  it("accepts a valid note", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "Certificat médical fourni.",
      driveLink: "",
      hasFile: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a Drive link", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "",
      driveLink: "https://drive.google.com/file/d/abc123/view",
      hasFile: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a file", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "",
      driveLink: "",
      hasFile: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when no justification is provided", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "",
      driveLink: "",
      hasFile: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Drive URL", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "",
      driveLink: "https://example.com/file.pdf",
      hasFile: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a note over 2000 chars", () => {
    const result = absenceJustificationSchema.safeParse({
      note: "x".repeat(2001),
      driveLink: "",
      hasFile: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("chatMessageSchema", () => {
  it("accepts a valid message", () => {
    const result = chatMessageSchema.safeParse({
      body: "Bonjour,",
      channelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const result = chatMessageSchema.safeParse({
      body: "",
      channelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a body over 5000 chars", () => {
    const result = chatMessageSchema.safeParse({
      body: "x".repeat(5001),
      channelId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid channel ID", () => {
    const result = chatMessageSchema.safeParse({
      body: "Hello",
      channelId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("localeSchema", () => {
  it("accepts fr, ar, en", () => {
    expect(localeSchema.safeParse("fr").success).toBe(true);
    expect(localeSchema.safeParse("ar").success).toBe(true);
    expect(localeSchema.safeParse("en").success).toBe(true);
  });

  it("rejects unknown locales", () => {
    expect(localeSchema.safeParse("de").success).toBe(false);
  });
});

describe("themeSchema", () => {
  it("accepts dark and light", () => {
    expect(themeSchema.safeParse("dark").success).toBe(true);
    expect(themeSchema.safeParse("light").success).toBe(true);
  });

  it("rejects unknown themes", () => {
    expect(themeSchema.safeParse("blue").success).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("accepts a valid UUID", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects an invalid UUID", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("fileUploadSchema", () => {
  it("accepts a valid PDF under 10MB", () => {
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const result = fileUploadSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("accepts a valid PNG under 10MB", () => {
    const file = new File(["content"], "test.png", { type: "image/png" });
    const result = fileUploadSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it("rejects a file over 10MB", () => {
    const bigContent = new Uint8Array(MAX_JUSTIFICATION_FILE_SIZE + 1);
    const file = new File([bigContent], "big.pdf", { type: "application/pdf" });
    const result = fileUploadSchema.safeParse(file);
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported file type", () => {
    const file = new File(["content"], "test.exe", { type: "application/octet-stream" });
    const result = fileUploadSchema.safeParse(file);
    expect(result.success).toBe(false);
  });
});

describe("ALLOWED_JUSTIFICATION_FILE_TYPES", () => {
  it("includes PDF, PNG, JPEG, WebP", () => {
    expect(ALLOWED_JUSTIFICATION_FILE_TYPES).toContain("application/pdf");
    expect(ALLOWED_JUSTIFICATION_FILE_TYPES).toContain("image/png");
    expect(ALLOWED_JUSTIFICATION_FILE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_JUSTIFICATION_FILE_TYPES).toContain("image/webp");
  });
});

describe("MAX_JUSTIFICATION_FILE_SIZE", () => {
  it("is 10MB", () => {
    expect(MAX_JUSTIFICATION_FILE_SIZE).toBe(10 * 1024 * 1024);
  });
});
