"use client";

import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge } from "./StatusBadge";

export type FactoryRow = {
  id: string;
  canonicalName: string;
  country: string;
  province: string | null;
  city: string | null;
  addressRaw: string | null;
  riskLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  importReadinessScore: number;
  geocodeConfidence: number | null;
  productCount: number;
  certificateCount: number;
  riskEventCount: number;
};

export function FactoriesTable({ rows }: { rows: FactoryRow[] }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const columns = useMemo<ColumnDef<FactoryRow>[]>(
    () => [
      {
        accessorKey: "canonicalName",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Factory <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <Link className="font-medium text-cobalt hover:underline" href={`/factories/${row.original.id}`}>
            {row.original.canonicalName}
          </Link>
        )
      },
      {
        accessorKey: "city",
        header: "Location",
        cell: ({ row }) => [row.original.country, row.original.province, row.original.city].filter(Boolean).join(" · ")
      },
      {
        accessorKey: "riskLevel",
        header: "Risk",
        cell: ({ row }) => <RiskBadge value={row.original.riskLevel} />
      },
      {
        accessorKey: "importReadinessScore",
        header: "Readiness",
        cell: ({ row }) => `${row.original.importReadinessScore}/100`
      },
      {
        accessorKey: "productCount",
        header: "Products"
      },
      {
        accessorKey: "certificateCount",
        header: "Certs"
      },
      {
        accessorKey: "riskEventCount",
        header: "Events"
      },
      {
        accessorKey: "geocodeConfidence",
        header: "Geo",
        cell: ({ row }) =>
          row.original.geocodeConfidence === null ? "추가 확인 필요" : `${Math.round(row.original.geocodeConfidence * 100)}%`
      }
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="rounded-md border border-line bg-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          placeholder="공장명, 도시, 주소 검색"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-panel/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
