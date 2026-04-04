import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { APP_NAME, COMPANY_LETTERHEAD } from "@/lib/constants";

export type FinishedGoodsPdfRow = {
  balance: number;
  createdAt: string;
  dispatch: number;
  name: string;
  production: number;
  size: string;
  unit: string;
  updatedAt: string;
};

export type FinishedGoodsPdfGroup = {
  masterName: string | null;
  rows: FinishedGoodsPdfRow[];
};

type FinishedGoodsReportProps = {
  durationLabel: string;
  generatedLabel: string;
  groups: FinishedGoodsPdfGroup[];
  warehouseCode: string;
};

const styles = StyleSheet.create({
  brandBand: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    color: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  body: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 24,
  },
  cell: {
    borderBottom: "1 solid #e5e7eb",
    padding: 6,
  },
  footerText: {
    color: "#6b7280",
    fontSize: 8,
    marginTop: 2,
  },
  letterpadMeta: {
    color: "#cbd5e1",
    fontSize: 8,
    marginTop: 2,
  },
  letterpadTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  groupHeader: {
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #d1d5db",
    padding: 6,
  },
  headerMeta: {
    color: "#4b5563",
    fontSize: 10,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  tableHeader: {
    backgroundColor: "#111827",
    color: "#ffffff",
    flexDirection: "row",
    fontWeight: 700,
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
  },
  topMetaCard: {
    backgroundColor: "#f8fafc",
    border: "1 solid #dbeafe",
    borderRadius: 8,
    marginTop: 8,
    padding: 8,
  },
});

function numberText(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function FinishedGoodsReport({
  durationLabel,
  generatedLabel,
  groups,
  warehouseCode,
}: FinishedGoodsReportProps) {
  let totalProduction = 0;
  let totalDispatch = 0;
  let totalBalance = 0;

  for (const group of groups) {
    for (const row of group.rows) {
      totalProduction += row.production;
      totalDispatch += row.dispatch;
      totalBalance += row.balance;
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.body}>
        <View style={styles.brandBand}>
          <Text style={styles.letterpadTitle}>{APP_NAME.toUpperCase()}</Text>
          <Text style={styles.letterpadMeta}>{COMPANY_LETTERHEAD.tagline}</Text>
          <Text style={styles.letterpadMeta}>
            {COMPANY_LETTERHEAD.address}
          </Text>
          <Text style={styles.letterpadMeta}>
            Phone: {COMPANY_LETTERHEAD.phone} | Email: {COMPANY_LETTERHEAD.email}
          </Text>
          <Text style={styles.letterpadMeta}>
            Website: {COMPANY_LETTERHEAD.website} | {COMPANY_LETTERHEAD.gstin}
          </Text>
        </View>

        <View style={styles.topMetaCard}>
          <Text style={styles.headerTitle}>Finished Goods Stock Statement</Text>
          <Text style={styles.headerMeta}>Warehouse: {warehouseCode}</Text>
          <Text style={styles.headerMeta}>Period: {durationLabel}</Text>
          <Text style={styles.headerMeta}>Generated On: {generatedLabel}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={{ ...styles.cell, width: "30%" }}>Good Name</Text>
          <Text style={{ ...styles.cell, width: "15%" }}>Size</Text>
          <Text style={{ ...styles.cell, width: "18%" }}>Production</Text>
          <Text style={{ ...styles.cell, width: "18%" }}>Dispatch</Text>
          <Text style={{ ...styles.cell, width: "19%" }}>Balance</Text>
        </View>

        {groups.map((group, index) => (
          <View key={`${group.masterName ?? "flat"}-${index}`}>
            {group.masterName ? (
              <View style={styles.groupHeader}>
                <Text>{group.masterName}</Text>
              </View>
            ) : null}

            {group.rows.map((row, rowIndex) => (
              <View
                key={`${row.name}-${rowIndex}`}
                style={{
                  ...styles.tableRow,
                  backgroundColor: rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb",
                }}
              >
                <Text style={{ ...styles.cell, width: "30%" }}>
                  {group.masterName ? `  ${row.name}` : row.name}
                </Text>
                <Text style={{ ...styles.cell, width: "15%" }}>{row.size}</Text>
                <Text style={{ ...styles.cell, width: "18%" }}>
                  {numberText(row.production)}
                </Text>
                <Text style={{ ...styles.cell, width: "18%" }}>
                  {numberText(row.dispatch)}
                </Text>
                <Text style={{ ...styles.cell, width: "19%" }}>
                  {numberText(row.balance)} {row.unit}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={{ ...styles.tableRow, backgroundColor: "#e5e7eb", marginTop: 8 }}>
          <Text style={{ ...styles.cell, width: "45%", fontWeight: 700 }}>GRAND TOTAL</Text>
          <Text style={{ ...styles.cell, width: "18%", fontWeight: 700 }}>
            {numberText(totalProduction)}
          </Text>
          <Text style={{ ...styles.cell, width: "18%", fontWeight: 700 }}>
            {numberText(totalDispatch)}
          </Text>
          <Text style={{ ...styles.cell, width: "19%", fontWeight: 700 }}>
            {numberText(totalBalance)}
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          {groups.flatMap((group) => group.rows).map((row, index) => (
            <Text key={`${row.name}-meta-${index}`} style={styles.footerText}>
              {row.name}: Added {row.createdAt} | Last Updated {row.updatedAt}
            </Text>
          ))}
        </View>

        <View
          style={{
            borderTop: "1 solid #cbd5e1",
            marginTop: 12,
            paddingTop: 6,
          }}
        >
          <Text style={styles.footerText}>
            This is a system-generated report on company letterpad for internal and audit use.
          </Text>
          <Text style={styles.footerText}>
            {APP_NAME} | {COMPANY_LETTERHEAD.address} | {COMPANY_LETTERHEAD.phone}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
