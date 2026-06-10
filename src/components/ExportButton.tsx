'use client';

import { useState } from 'react';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import { useDuckDBService } from '@/lib/duckdb/useDuckDBService';
import { useDuckDBRaw } from '@/lib/duckdb/context';
import { stripQuotes } from '@/lib/utils/fieldFormat';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';

type ExportFormat = 'csv' | 'json' | 'parquet';

interface ExportButtonProps {
  docketId: string;
  agencyCode: string;
  docket: Record<string, any> | null;
  documents: any[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert array of objects to CSV string */
function toCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';

  // Get all unique keys across all rows
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));

  const escapeCSV = (val: any): string => {
    if (val == null) return '';
    const str = stripQuotes(String(val));
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.join(',');
  const lines = rows.map(row => keys.map(k => escapeCSV(row[k])).join(','));
  return [header, ...lines].join('\n');
}

/** Clean row values by stripping quotes */
function cleanRow(row: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    cleaned[key] = typeof val === 'string' ? stripQuotes(val) : val;
  }
  return cleaned;
}

export function ExportButton({ docketId, agencyCode, docket, documents }: ExportButtonProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const { getAllCommentsForDocket } = useDuckDBService();
  const { db, conn, isReady } = useDuckDBRaw();

  // Radix handles outside-click + escape close natively, so the dropdown
  // state we previously juggled with refs + useEffect goes away. We still
  // track `exporting` to render the spinner.

  const baseFilename = `${docketId}_${today()}`;

  async function exportCSV() {
    setExporting('csv');
    try {
      const comments = await getAllCommentsForDocket(docketId);
      const cleaned = comments.map(cleanRow);
      const csv = toCSV(cleaned);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `${baseFilename}.csv`);
    } finally {
      setExporting(null);
    }
  }

  async function exportJSON() {
    setExporting('json');
    try {
      const comments = await getAllCommentsForDocket(docketId);
      const payload = {
        docket: docket ? cleanRow(docket) : null,
        documents: documents.map(cleanRow),
        comments: comments.map(cleanRow),
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      triggerDownload(blob, `${baseFilename}.json`);
    } finally {
      setExporting(null);
    }
  }

  async function exportParquet() {
    if (!db || !conn) return;
    setExporting('parquet');
    try {
      const cleanId = docketId.replace(/^"|"$/g, '').toUpperCase();
      const agency = cleanId.split('-')[0];
      const R2_BASE_URL = 'https://pub-5fc11ad134984edf8d9af452dd1849d6.r2.dev';

      // Query the comments index to find partition files for this docket
      const indexResult = await conn.query(`
        SELECT agency_code, docket_id, year, month
        FROM read_parquet('${R2_BASE_URL}/comments_index.parquet')
        WHERE agency_code = '${agency}' AND docket_id = '${cleanId}'
      `);
      const rows = indexResult.toArray().map((r: any) => r.toJSON());

      if (rows.length === 0) {
        setExporting(null);
        return;
      }

      const urls = rows.map((r: any) =>
        `'${R2_BASE_URL}/comments/agency_code=${r.agency_code}/docket_id=${r.docket_id}/year=${r.year}/month=${r.month}/part-0.parquet'`
      );
      const commentsSource = `read_parquet([${urls.join(', ')}], union_by_name=true)`;

      const exportPath = '/tmp/export.parquet';

      await conn.query(`
        COPY (
          SELECT * FROM ${commentsSource}
          WHERE REPLACE(docket_id, '"', '') = '${cleanId}'
          ORDER BY posted_date DESC
          LIMIT 50000
        ) TO '${exportPath}' (FORMAT PARQUET)
      `);

      const buffer = await db.copyFileToBuffer(exportPath);
      const blob = new Blob([new Uint8Array(buffer) as BlobPart], { type: 'application/octet-stream' });
      triggerDownload(blob, `${baseFilename}.parquet`);

      // Clean up virtual filesystem
      await db.dropFile(exportPath);
    } finally {
      setExporting(null);
    }
  }

  const formats: { id: ExportFormat; label: string; description: string; handler: () => Promise<void> }[] = [
    { id: 'csv', label: 'CSV', description: 'Comments table for Excel', handler: exportCSV },
    { id: 'json', label: 'JSON', description: 'Full docket bundle', handler: exportJSON },
    { id: 'parquet', label: 'Parquet', description: 'Comments for Python/R', handler: exportParquet },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!isReady || exporting !== null}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-[var(--surface-elevated)] border border-[var(--border)]
          text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-primary)]
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exporting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
        {exporting ? 'Exporting...' : 'Export'}
        <ChevronDown size={12} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {formats.map((fmt) => (
          <DropdownMenuItem
            key={fmt.id}
            disabled={exporting !== null}
            // Radix's Item onSelect fires from both click and keyboard
            // (Enter / Space) — preferred over onClick.
            onSelect={(e) => {
              // Keep the menu open while the export resolves so the spinner
              // is visible. Radix closes on select by default; preventDefault
              // overrides that for this row only.
              e.preventDefault();
              void fmt.handler();
            }}
            className="flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">{fmt.label}</div>
              <div className="text-xs text-[var(--muted)]">{fmt.description}</div>
            </div>
            {exporting === fmt.id && (
              <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
