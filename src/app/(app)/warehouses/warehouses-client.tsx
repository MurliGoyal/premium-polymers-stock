"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Warehouse, Package, AlertTriangle, ArrowRightLeft,
  ArrowRight, BarChart3, OctagonAlert, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type WarehouseData = {
  id: string; code: string; name: string; slug: string;
  subtitle: string; gradient: string;
  totalMaterials: number; inStockCount: number; lowStockCount: number; outOfStockCount: number;
  totalStock: number; recentTransfers: number; totalTransferQty: number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

export function WarehousesClient({ warehouses }: { warehouses: WarehouseData[] }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={cardVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Select a warehouse to manage its raw materials</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {warehouses.map((w) => (
          <motion.div key={w.id} variants={cardVariants}>
            <Link href={`/warehouses/${w.slug}`}>
              <Card className="group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-2 hover:border-primary/20 relative overflow-hidden">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${w.gradient}`} />
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardContent className="relative p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                        <Warehouse className="h-7 w-7" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">{w.code}</h2>
                        <p className="text-sm text-muted-foreground">{w.subtitle || w.name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="mb-5 grid grid-cols-4 gap-2">
                    {[
                      { label: "Healthy", value: w.inStockCount, tone: "bg-emerald-500/80" },
                      { label: "Low", value: w.lowStockCount, tone: "bg-amber-500/80" },
                      { label: "Empty", value: w.outOfStockCount, tone: "bg-red-500/80" },
                      { label: "Moves", value: w.recentTransfers, tone: "bg-blue-500/80" },
                    ].map((bar) => (
                      <div key={bar.label} className="space-y-2 rounded-2xl border bg-background/70 p-3 backdrop-blur">
                        <div className="flex items-end justify-between">
                          <p className="text-lg font-semibold">{bar.value}</p>
                          <div className={`h-2 w-8 rounded-full ${bar.tone}`} />
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{bar.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <Package className="h-4 w-4 mx-auto mb-1.5 text-muted-foreground" />
                      <p className="text-xl font-bold">{w.totalMaterials}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Materials</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <BarChart3 className="h-4 w-4 mx-auto mb-1.5 text-emerald-500" />
                      <p className="text-xl font-bold">{formatNumber(w.totalStock)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Stock</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/50 text-center">
                      <ArrowRightLeft className="h-4 w-4 mx-auto mb-1.5 text-blue-500" />
                      <p className="text-xl font-bold">{w.recentTransfers}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Transfers (7d)</p>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success" className="text-[11px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {w.inStockCount} In Stock
                    </Badge>
                    {w.lowStockCount > 0 && (
                      <Badge variant="warning" className="text-[11px] gap-1">
                        <AlertTriangle className="h-3 w-3" /> {w.lowStockCount} Low Stock
                      </Badge>
                    )}
                    {w.outOfStockCount > 0 && (
                      <Badge variant="danger" className="text-[11px] gap-1">
                        <OctagonAlert className="h-3 w-3" /> {w.outOfStockCount} Out of Stock
                      </Badge>
                    )}
                  </div>

                  {/* Action hint */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                    <span>Open Warehouse</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
