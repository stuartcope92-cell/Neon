import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatGBP, formatQuantity, lineTotal, toNumber, type Totals } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type QuotePdfData = {
  quoteNumber: string;
  createdAt: Date;
  validUntil: string | null;
  signDescription: string;
  discountPercent: string;
  vatApplied: boolean;
  vatRatePercent: string;
  termsAndNotes: string;
  customer: { name: string; email: string | null; phone: string | null; address: string | null };
  lineItems: Array<{ id: number; description: string; quantity: string; unitPrice: string }>;
  totals: Totals;
  company: {
    name: string;
    logo: string | null;
    addressLines: string[];
    contactLines: string[];
  };
};

const BRAND = "#d81b78";
const INK = "#14141c";
const MUTED = "#6b6b7b";
const LINE = "#d9d9e3";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 9.5,
    color: INK,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: {
    maxHeight: 62,
    maxWidth: 120,
    marginBottom: 8,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: INK,
    borderStyle: "solid",
  },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  muted: { color: MUTED },
  metaBox: { alignItems: "flex-end" },
  quoteTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 4 },
  rule: { height: 2, backgroundColor: BRAND, marginTop: 14, marginBottom: 16 },
  columns: { flexDirection: "row", gap: 24, marginBottom: 18 },
  column: { flex: 1 },
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  strong: { fontFamily: "Helvetica-Bold" },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 5,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 6,
  },
  colDescription: { flex: 1, paddingRight: 8 },
  colQty: { width: 52, textAlign: "right" },
  colUnit: { width: 74, textAlign: "right" },
  colTotal: { width: 74, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 5,
    paddingTop: 6,
  },
  grandTotal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND },
  terms: {
    marginTop: 26,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 10,
    fontSize: 8,
    color: MUTED,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7.5,
    color: MUTED,
  },
});

export default function QuoteDocument({ data }: { data: QuotePdfData }) {
  const { company, customer, totals } = data;

  return (
    <Document
      title={`Quote ${data.quoteNumber}`}
      author={company.name || "Neon Quote Creator"}
      subject={data.signDescription}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            {company.logo ? <Image src={company.logo} style={styles.logo} /> : null}
            <Text style={styles.companyName}>{company.name || "Quotation"}</Text>
            {company.addressLines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            {company.contactLines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.quoteTitle}>QUOTE</Text>
            <Text style={styles.strong}>{data.quoteNumber}</Text>
            <Text style={styles.muted}>Issued {formatDate(data.createdAt)}</Text>
            <Text style={styles.muted}>Valid until {formatDate(data.validUntil)}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Quote for</Text>
            <Text style={styles.strong}>{customer.name}</Text>
            {customer.address ? <Text style={styles.muted}>{customer.address}</Text> : null}
            {customer.email ? <Text style={styles.muted}>{customer.email}</Text> : null}
            {customer.phone ? <Text style={styles.muted}>{customer.phone}</Text> : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionLabel}>Sign</Text>
            <Text>{data.signDescription || "—"}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.colDescription, styles.sectionLabel]}>Description</Text>
          <Text style={[styles.colQty, styles.sectionLabel]}>Qty</Text>
          <Text style={[styles.colUnit, styles.sectionLabel]}>Unit price</Text>
          <Text style={[styles.colTotal, styles.sectionLabel]}>Total</Text>
        </View>

        {data.lineItems.map((item) => (
          <View key={item.id} style={styles.row} wrap={false}>
            <Text style={styles.colDescription}>{item.description}</Text>
            <Text style={styles.colQty}>{formatQuantity(toNumber(item.quantity))}</Text>
            <Text style={styles.colUnit}>{formatGBP(toNumber(item.unitPrice))}</Text>
            <Text style={[styles.colTotal, styles.strong]}>
              {formatGBP(lineTotal(item.quantity, item.unitPrice))}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatGBP(totals.subtotal)}</Text>
          </View>
          {totals.discount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>
                Discount ({formatQuantity(toNumber(data.discountPercent))}%)
              </Text>
              <Text>-{formatGBP(totals.discount)}</Text>
            </View>
          ) : null}
          {data.vatApplied ? (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>
                VAT ({formatQuantity(toNumber(data.vatRatePercent))}%)
              </Text>
              <Text>{formatGBP(totals.vat)}</Text>
            </View>
          ) : (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>VAT</Text>
              <Text>Not applied</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.strong}>Total</Text>
            <Text style={styles.grandTotal}>{formatGBP(totals.total)}</Text>
          </View>
        </View>

        {data.termsAndNotes ? <Text style={styles.terms}>{data.termsAndNotes}</Text> : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1
              ? `${data.quoteNumber} · page ${pageNumber} of ${totalPages}`
              : data.quoteNumber
          }
          fixed
        />
      </Page>
    </Document>
  );
}
