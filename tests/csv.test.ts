import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/csv";

interface Row {
  name: string;
  amount: number | null;
}

const columns = [
  { header: "Name", value: (r: Row) => r.name },
  { header: "Amount", value: (r: Row) => r.amount },
];

describe("buildCsv", () => {
  it("builds a header row plus one row per record", () => {
    const csv = buildCsv<Row>([{ name: "Alice", amount: 100 }, { name: "Bob", amount: 200 }], columns);
    expect(csv).toBe("Name,Amount\r\nAlice,100\r\nBob,200");
  });

  it("quotes fields containing commas", () => {
    const csv = buildCsv<Row>([{ name: "Smith, John", amount: 1 }], columns);
    expect(csv).toBe('Name,Amount\r\n"Smith, John",1');
  });

  it("quotes and escapes fields containing double quotes", () => {
    const csv = buildCsv<Row>([{ name: 'Say "hi"', amount: 1 }], columns);
    expect(csv).toBe('Name,Amount\r\n"Say ""hi""",1');
  });

  it("quotes fields containing newlines", () => {
    const csv = buildCsv<Row>([{ name: "Line1\nLine2", amount: 1 }], columns);
    expect(csv).toBe('Name,Amount\r\n"Line1\nLine2",1');
  });

  it("renders null values as an empty field", () => {
    const csv = buildCsv<Row>([{ name: "NoAmount", amount: null }], columns);
    expect(csv).toBe("Name,Amount\r\nNoAmount,");
  });

  it("returns just the header row for an empty dataset", () => {
    expect(buildCsv<Row>([], columns)).toBe("Name,Amount");
  });
});
