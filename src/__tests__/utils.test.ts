import {
  slugify,
  hashApiKey,
  generateWebhookSignature,
  verifyWebhookSignature,
  calculateDerivedMetrics,
  isValidCpf,
  isValidCnpj,
  getScoreColor,
  getScoreLabel,
} from "@/lib/utils";

// ── slugify ──────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("lowercases the string", () => {
    expect(slugify("NUFLUMA PRO")).toBe("nufluma-pro");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(slugify("hello@world!")).toBe("helloworld");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special chars", () => {
    expect(slugify("!@#$%")).toBe("");
  });
});

// ── hashApiKey ────────────────────────────────────────────────────────────────

describe("hashApiKey", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashApiKey("nfm_abc123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashApiKey("nfm_abc")).toBe(hashApiKey("nfm_abc"));
  });

  it("produces different hashes for different keys", () => {
    expect(hashApiKey("nfm_key1")).not.toBe(hashApiKey("nfm_key2"));
  });
});

// ── generateWebhookSignature / verifyWebhookSignature ─────────────────────────

describe("webhook signature", () => {
  const secret = "my-secret";
  const payload = '{"event":"test","data":{"id":1}}';

  it("generateWebhookSignature returns a 64-char hex HMAC-SHA256", () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verify returns true for a valid signature", () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("verify returns false for a tampered payload", () => {
    const sig = generateWebhookSignature(payload, secret);
    const tampered = payload.replace("test", "tampered");
    expect(verifyWebhookSignature(tampered, sig, secret)).toBe(false);
  });

  it("verify returns false for a wrong secret", () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, "wrong-secret")).toBe(false);
  });

  it("is deterministic: same payload + secret → same signature", () => {
    expect(generateWebhookSignature(payload, secret)).toBe(
      generateWebhookSignature(payload, secret)
    );
  });
});

// ── calculateDerivedMetrics ───────────────────────────────────────────────────

describe("calculateDerivedMetrics", () => {
  it("calculates all metrics correctly", () => {
    const result = calculateDerivedMetrics({
      impressions: 10000,
      clicks: 200,
      leads: 20,
      conversions: 10,
      spend: 1000,
      revenue: 5000,
    });

    expect(result.ctr).toBeCloseTo(2); // (200/10000)*100
    expect(result.cpc).toBeCloseTo(5); // 1000/200
    expect(result.cpl).toBeCloseTo(50); // 1000/20
    expect(result.cpa).toBeCloseTo(100); // 1000/10
    expect(result.roas).toBeCloseTo(5); // 5000/1000
    expect(result.convRate).toBeCloseTo(5); // (10/200)*100
  });

  it("returns null for metrics when inputs are missing", () => {
    const result = calculateDerivedMetrics({});
    expect(result.ctr).toBeNull();
    expect(result.cpc).toBeNull();
    expect(result.cpl).toBeNull();
    expect(result.cpa).toBeNull();
    expect(result.roas).toBeNull();
    expect(result.convRate).toBeNull();
  });

  it("returns null when clicks is zero (avoids division by zero)", () => {
    const result = calculateDerivedMetrics({
      impressions: 10000,
      clicks: 0,
      spend: 500,
    });
    expect(result.ctr).toBeNull();
    expect(result.cpc).toBeNull();
  });

  it("calculates partial metrics when some fields are provided", () => {
    const result = calculateDerivedMetrics({ clicks: 100, spend: 400 });
    expect(result.cpc).toBeCloseTo(4);
    expect(result.ctr).toBeNull();
    expect(result.cpl).toBeNull();
  });
});

// ── isValidCpf ────────────────────────────────────────────────────────────────

describe("isValidCpf", () => {
  it("accepts a valid CPF", () => {
    // CPFs matematicamente válidos
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });

  it("rejects all-same-digit CPFs", () => {
    ["00000000000", "11111111111", "99999999999"].forEach((cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    });
  });

  it("rejects CPF with wrong length", () => {
    expect(isValidCpf("1234567890")).toBe(false); // 10 digits
    expect(isValidCpf("123456789012")).toBe(false); // 12 digits
  });

  it("rejects CPF with invalid check digits", () => {
    expect(isValidCpf("52998224726")).toBe(false); // last digit changed
    expect(isValidCpf("52998224715")).toBe(false); // both digits changed
  });
});

// ── isValidCnpj ───────────────────────────────────────────────────────────────

describe("isValidCnpj", () => {
  it("accepts a valid CNPJ", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("45997418000153")).toBe(true);
  });

  it("rejects all-same-digit CNPJs", () => {
    ["00000000000000", "11111111111111", "99999999999999"].forEach((cnpj) => {
      expect(isValidCnpj(cnpj)).toBe(false);
    });
  });

  it("rejects CNPJ with wrong length", () => {
    expect(isValidCnpj("1122233300018")).toBe(false); // 13 digits
    expect(isValidCnpj("112223330001810")).toBe(false); // 15 digits
  });

  it("rejects CNPJ with invalid check digits", () => {
    expect(isValidCnpj("11222333000182")).toBe(false); // last digit changed
  });
});

// ── getScoreColor / getScoreLabel ─────────────────────────────────────────────

describe("getScoreColor", () => {
  it("returns green for scores >= 80", () => {
    expect(getScoreColor(80)).toBe("text-green-400");
    expect(getScoreColor(100)).toBe("text-green-400");
  });

  it("returns yellow for scores 60-79", () => {
    expect(getScoreColor(60)).toBe("text-yellow-400");
    expect(getScoreColor(79)).toBe("text-yellow-400");
  });

  it("returns orange for scores 40-59", () => {
    expect(getScoreColor(40)).toBe("text-orange-400");
    expect(getScoreColor(59)).toBe("text-orange-400");
  });

  it("returns red for scores < 40", () => {
    expect(getScoreColor(0)).toBe("text-red-400");
    expect(getScoreColor(39)).toBe("text-red-400");
  });
});

describe("getScoreLabel", () => {
  it("labels correctly per band", () => {
    expect(getScoreLabel(100)).toBe("Excelente");
    expect(getScoreLabel(80)).toBe("Excelente");
    expect(getScoreLabel(79)).toBe("Bom");
    expect(getScoreLabel(60)).toBe("Bom");
    expect(getScoreLabel(59)).toBe("Regular");
    expect(getScoreLabel(40)).toBe("Regular");
    expect(getScoreLabel(39)).toBe("Crítico");
    expect(getScoreLabel(0)).toBe("Crítico");
  });
});
