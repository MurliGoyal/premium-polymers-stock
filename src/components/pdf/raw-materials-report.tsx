import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { APP_NAME, COMPANY_LETTERHEAD } from "@/lib/constants";
import {
  formatRawMaterialPdfSizeText,
  type RawMaterialPdfCategory,
  type RawMaterialPdfMaterial,
  type RawMaterialPdfSource,
} from "@/lib/raw-materials-pdf";
import { formatPdfDate } from "@/lib/pdf-utils";

type RawMaterialsReportProps = {
  categories: RawMaterialPdfCategory[];
  durationLabel: string;
  generatedLabel: string;
  reportTitle: string;
};

const styles = StyleSheet.create({
  body: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 24,
  },
  brandBand: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    color: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  brandMeta: {
    color: "#cbd5e1",
    fontSize: 8,
    marginTop: 2,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  categoryHeader: {
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #d1d5db",
    padding: 6,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 8,
    marginTop: 2,
  },
  headerCard: {
    backgroundColor: "#f8fafc",
    border: "1 solid #dbeafe",
    borderRadius: 8,
    marginTop: 8,
    padding: 8,
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
  row: {
    flexDirection: "row",
  },
  rowCell: {
    borderBottom: "1 solid #e5e7eb",
    padding: 6,
  },
  sourceLine: {
    color: "#6b7280",
    fontSize: 8,
    marginTop: 1,
  },
  stockValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  tableHeader: {
    backgroundColor: "#111827",
    color: "#ffffff",
    flexDirection: "row",
    fontWeight: 700,
  },
  vendorText: {
    color: "#6b7280",
    fontSize: 8,
    marginTop: 1,
  },
});

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(value);
}

function getSourceSummary(source: RawMaterialPdfSource, unit: string) {
  return `${source.warehouseCode}: ${formatNumber(source.currentStock)} ${unit}`;
}

function PdfRow({ material, index }: { index: number; material: RawMaterialPdfMaterial }) {
  const sizeText = formatRawMaterialPdfSizeText(material);

  return (
    <View
      style={{
        ...styles.row,
        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
      }}
    >
      <View style={{ ...styles.rowCell, width: "33%" }}>
        <Text>{material.displayName}</Text>
        {material.vendorName ? <Text style={styles.vendorText}>Vendor: {material.vendorName}</Text> : null}
      </View>
      <Text style={{ ...styles.rowCell, width: "12%" }}>{material.gsm !== null ? formatNumber(material.gsm) : "—"}</Text>
      <Text style={{ ...styles.rowCell, width: "12%" }}>{material.baseUnit}</Text>
      <Text style={{ ...styles.rowCell, width: "15%" }}>{sizeText}</Text>
      <View style={{ ...styles.rowCell, width: "28%" }}>
        <Text style={styles.stockValue}>
          {formatNumber(material.currentStock)} {material.baseUnit}
        </Text>
        {material.sourceWarehouses.length > 0 ? (
          <View style={{ marginTop: 2 }}>
            {material.sourceWarehouses.map((source, sourceIndex) => (
              <Text key={`${material.id}-${source.warehouseCode}-${sourceIndex}`} style={styles.sourceLine}>
                {getSourceSummary(source, material.baseUnit)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function RawMaterialsReport({ categories, durationLabel, generatedLabel, reportTitle }: RawMaterialsReportProps) {
  const totalMaterials = categories.reduce((count, category) => count + category.materials.length, 0);
  const totalStock = categories.reduce(
    (sum, category) => sum + category.materials.reduce((categorySum, material) => categorySum + material.currentStock, 0),
    0,
  );

  return (
    <Document>
      <Page size="A4" style={styles.body}>
        <View style={styles.brandBand}>
          <Text style={styles.brandTitle}>{APP_NAME.toUpperCase()}</Text>
          <Text style={styles.brandMeta}>{COMPANY_LETTERHEAD.tagline}</Text>
          <Text style={styles.brandMeta}>{COMPANY_LETTERHEAD.address}</Text>
          <Text style={styles.brandMeta}>
            Phone: {COMPANY_LETTERHEAD.phone} | Email: {COMPANY_LETTERHEAD.email}
          </Text>
          <Text style={styles.brandMeta}>
            Website: {COMPANY_LETTERHEAD.website} | {COMPANY_LETTERHEAD.gstin}
          </Text>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{reportTitle}</Text>
          <Text style={styles.headerMeta}>Period: {durationLabel}</Text>
          <Text style={styles.headerMeta}>Generated On: {generatedLabel}</Text>
          <Text style={styles.headerMeta}>
            Materials: {formatNumber(totalMaterials)} | Combined stock: {formatNumber(totalStock)}
          </Text>
        </View>

        {categories.length === 0 ? (
          <View style={{ marginTop: 16 }}>
            <Text>No raw materials matched the selected period.</Text>
          </View>
        ) : null}

        {categories.map((category) => (
          <View key={category.categoryName} style={{ marginTop: 12 }}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category.categoryName}</Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={{ ...styles.rowCell, width: "33%" }}>Name</Text>
              <Text style={{ ...styles.rowCell, width: "12%" }}>GSM</Text>
              <Text style={{ ...styles.rowCell, width: "12%" }}>Unit</Text>
              <Text style={{ ...styles.rowCell, width: "15%" }}>Size</Text>
              <Text style={{ ...styles.rowCell, width: "28%" }}>In Stock</Text>
            </View>

            {category.materials.map((material, index) => (
              <PdfRow key={material.id} index={index} material={material} />
            ))}
          </View>
        ))}

        <View
          style={{
            ...styles.row,
            backgroundColor: "#e5e7eb",
            marginTop: 12,
          }}
        >
          <Text style={{ ...styles.rowCell, fontWeight: 700, width: "72%" }}>GRAND TOTAL</Text>
          <Text style={{ ...styles.rowCell, fontWeight: 700, width: "28%" }}>{formatNumber(totalStock)}</Text>
        </View>

        <View style={{ marginTop: 10 }}>
          {categories.flatMap((category) => category.materials).map((material, index) => (
            <Text key={`${material.id}-meta-${index}`} style={styles.footerText}>
              {material.displayName}: Updated {formatPdfDate(material.updatedAt)}
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
            This is a system-generated raw materials report on company letterpad for internal and audit use.
          </Text>
          <Text style={styles.footerText}>
            {APP_NAME} | {COMPANY_LETTERHEAD.address} | {COMPANY_LETTERHEAD.phone}
          </Text>
        </View>
      </Page>
    </Document>
  );
}