import React, { useMemo } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { performanceConfig } from '../../../utils/performance/thresholds';

export interface VirtualizedColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: number | string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
}

export interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: VirtualizedColumn<T>[];
  rowKey?: (item: T, index: number) => string;
  height?: number | string;
  maxHeight?: number | string;
  threshold?: number;
  emptyMessage?: string;
  isLoading?: boolean;
  isFa?: boolean;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
}

export function VirtualizedDataTable<T>({
  data,
  columns,
  rowKey,
  height = 560,
  maxHeight,
  threshold,
  emptyMessage,
  isLoading = false,
  isFa = true,
  className = '',
  tableClassName = '',
  headerClassName = '',
  rowClassName,
  onRowClick
}: VirtualizedDataTableProps<T>) {
  const activeThreshold = threshold ?? performanceConfig.getConfig().virtualizationRowThreshold;
  const isVirtualized = data.length > activeThreshold;

  const defaultEmptyText = isFa ? 'اطلاعاتی برای نمایش یافت نشد' : 'No data available';

  const getRowKey = (item: T, index: number) => {
    if (rowKey) return rowKey(item, index);
    const itemAny = item as any;
    return itemAny.id || itemAny._id || itemAny.key || itemAny.code || `row-${index}`;
  };

  // Standard static table fallback for small datasets (< threshold)
  if (!isVirtualized) {
    return (
      <div className={`w-full overflow-x-auto custom-scrollbar ${className}`} dir={isFa ? 'rtl' : 'ltr'}>
        <table className={`w-full text-xs text-right whitespace-nowrap ${tableClassName}`}>
          <thead className={`bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold sticky top-0 z-10 ${headerClassName}`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-3.5 py-3 ${col.headerClassName || ''}`}
                  onClick={col.sortable ? col.onSort : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                    <span>{isFa ? 'در حال بارگذاری اطلاعات...' : 'Loading data...'}</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  {emptyMessage || defaultEmptyText}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = getRowKey(item, index);
                const customRowClass = rowClassName ? rowClassName(item, index) : '';
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item, index)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${customRowClass}`}
                  >
                    {columns.map((col) => {
                      const cellContent = col.render ? col.render(item, index) : (item as any)[col.key];
                      return (
                        <td key={col.key} className={`px-3.5 py-3 text-slate-700 dark:text-slate-300 ${col.className || ''}`}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Virtualized Table for large datasets (> threshold)
  return (
    <div className={`w-full ${className}`} dir={isFa ? 'rtl' : 'ltr'}>
      <TableVirtuoso
        style={{ height, maxHeight }}
        data={data}
        className="custom-scrollbar"
        fixedHeaderContent={() => (
          <tr className={`bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold shadow-xs ${headerClassName}`}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={`px-3.5 py-3 text-right whitespace-nowrap text-xs ${col.headerClassName || ''}`}
                onClick={col.sortable ? col.onSort : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        )}
        itemContent={(index, item) => {
          const customRowClass = rowClassName ? rowClassName(item, index) : '';
          return (
            <>
              {columns.map((col) => {
                const cellContent = col.render ? col.render(item, index) : (item as any)[col.key];
                return (
                  <td
                    key={col.key}
                    className={`px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap ${col.className || ''}`}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </>
          );
        }}
        components={{
          Table: ({ style, ...props }) => (
            <table
              {...props}
              style={{ ...style, width: '100%', borderCollapse: 'collapse' }}
              className={`w-full text-xs text-right whitespace-nowrap ${tableClassName}`}
            />
          ),
          TableRow: ({ item, ...props }) => {
            const index = (props as any)['data-index'] || 0;
            const customRowClass = rowClassName && item ? rowClassName(item, index) : '';
            return (
              <tr
                {...props}
                onClick={() => item && onRowClick?.(item, index)}
                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${customRowClass}`}
              />
            );
          },
          EmptyPlaceholder: () => (
            <div className="py-12 text-center text-slate-400 text-xs">
              {emptyMessage || defaultEmptyText}
            </div>
          )
        }}
      />
    </div>
  );
}
