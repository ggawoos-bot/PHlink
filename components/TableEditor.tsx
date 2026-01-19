import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, Download, Upload } from 'lucide-react';
import { TableColumn, TableRow } from '../types';

interface TableEditorProps {
  columns: TableColumn[];
  value: TableRow[];
  onChange: (rows: TableRow[]) => void;
  minRows?: number;
  maxRows?: number;
  readOnly?: boolean;
  disabled?: boolean;
}

const TableEditor: React.FC<TableEditorProps> = ({
  columns,
  value,
  onChange,
  minRows = 1,
  maxRows = 100,
  readOnly = false,
  disabled = false,
}) => {
  const [rows, setRows] = useState<TableRow[]>(value);
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [copiedData, setCopiedData] = useState<string>('');
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const effectiveReadOnly = readOnly || disabled;

  useEffect(() => {
    setRows(value);
  }, [value]);

  useEffect(() => {
    setColWidths((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const col of columns) {
        const incoming = typeof col.width === 'number' ? col.width : undefined;
        if (next[col.id] == null) {
          next[col.id] = incoming ?? 150;
        } else if (incoming != null && next[col.id] !== incoming) {
          // If schema-provided width changes, respect it
          next[col.id] = incoming;
        }
      }

      // Remove widths for removed columns
      for (const key of Object.keys(next)) {
        if (!columns.some((c) => c.id === key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [columns]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = resizeStateRef.current;
      if (!st) return;
      e.preventDefault();

      const delta = e.clientX - st.startX;
      const nextWidth = Math.max(80, Math.min(800, st.startWidth + delta));
      setColWidths((prev) => ({ ...prev, [st.colId]: nextWidth }));
    };

    const onUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (effectiveReadOnly) return;
    if (rows.length === 0 && minRows > 0) {
      const initialRows = Array.from({ length: minRows }, () => createEmptyRow());
      setRows(initialRows);
      onChange(initialRows);
    }
  }, [effectiveReadOnly, minRows, columns]);

  const createEmptyRow = (): TableRow => ({
    id: `ROW${Date.now()}${Math.random()}`,
    data: columns.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {}),
  });

  const handleAddRow = () => {
    if (effectiveReadOnly) return;
    if (rows.length >= maxRows) {
      alert(`최대 ${maxRows}개 행까지만 추가할 수 있습니다.`);
      return;
    }
    const newRow = createEmptyRow();
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    onChange(updatedRows);
  };

  const handleDeleteRow = (rowId: string) => {
    if (effectiveReadOnly) return;
    if (rows.length <= minRows) {
      alert(`최소 ${minRows}개 행은 유지되어야 합니다.`);
      return;
    }
    const updatedRows = rows.filter(r => r.id !== rowId);
    setRows(updatedRows);
    onChange(updatedRows);
  };

  const handleCellChange = (rowId: string, colId: string, value: any) => {
    if (effectiveReadOnly) return;
    const updatedRows = rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          data: { ...row.data, [colId]: value },
        };
      }
      return row;
    });
    setRows(updatedRows);
    onChange(updatedRows);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (effectiveReadOnly) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    if (!pastedText) return;

    const lines = pastedText.split('\n').filter(line => line.trim());
    const newRows: TableRow[] = [];

    lines.forEach(line => {
      const cells = line.split('\t');
      if (cells.length === 0) return;

      const rowData: Record<string, any> = {};
      columns.forEach((col, idx) => {
        if (idx < cells.length) {
          let cellValue = cells[idx].trim();
          
          if (col.type === 'number') {
            const num = parseFloat(cellValue);
            cellValue = isNaN(num) ? '' : num;
          } else if (col.type === 'date') {
            if (cellValue && !cellValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
              cellValue = '';
            }
          }
          
          rowData[col.id] = cellValue;
        } else {
          rowData[col.id] = '';
        }
      });

      newRows.push({
        id: `ROW${Date.now()}${Math.random()}`,
        data: rowData,
      });
    });

    if (newRows.length > 0) {
      const totalRows = rows.length + newRows.length;
      if (totalRows > maxRows) {
        alert(`최대 ${maxRows}개 행까지만 추가할 수 있습니다. ${maxRows - rows.length}개 행만 추가됩니다.`);
        const allowedNewRows = newRows.slice(0, maxRows - rows.length);
        const updatedRows = [...rows, ...allowedNewRows];
        setRows(updatedRows);
        onChange(updatedRows);
      } else {
        const updatedRows = [...rows, ...newRows];
        setRows(updatedRows);
        onChange(updatedRows);
      }
    }
  };

  const handleCopy = () => {
    const tsvData = rows.map(row => 
      columns.map(col => row.data[col.id] || '').join('\t')
    ).join('\n');
    
    navigator.clipboard.writeText(tsvData).then(() => {
      alert('테이블 데이터가 클립보드에 복사되었습니다.');
    });
  };

  const handleExportCSV = () => {
    const csvContent = [
      columns.map(col => col.label).join(','),
      ...rows.map(row => 
        columns.map(col => {
          const value = row.data[col.id] || '';
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `table_data_${Date.now()}.csv`;
    link.click();
  };

  const renderCell = (row: TableRow, col: TableColumn) => {
    const value = row.data[col.id] || '';
    const isSelected = selectedCell?.rowId === row.id && selectedCell?.colId === col.id;

    if (effectiveReadOnly) {
      return (
        <div className="px-3 py-2 text-sm text-gray-700">
          {value}
        </div>
      );
    }

    switch (col.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
            className={`w-full px-2 py-1.5 text-sm border-0 outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected ? 'ring-2 ring-indigo-500' : ''
            }`}
          >
            <option value="">선택</option>
            {col.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
            className={`w-full px-2 py-1.5 text-sm border-0 outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected ? 'ring-2 ring-indigo-500' : ''
            }`}
            placeholder="숫자"
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
            className={`w-full px-2 py-1.5 text-sm border-0 outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected ? 'ring-2 ring-indigo-500' : ''
            }`}
          />
        );
      
      default: // text
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
            className={`w-full px-3 py-2.5 text-sm border-0 outline-none focus:ring-2 focus:ring-indigo-500 ${
              isSelected ? 'ring-2 ring-indigo-500' : ''
            }`}
            placeholder="입력"
          />
        );
    }
  };

  const validateRow = (row: TableRow): string[] => {
    const errors: string[] = [];
    columns.forEach(col => {
      if (col.required && !row.data[col.id]) {
        errors.push(col.label);
      }
    });
    return errors;
  };

  return (
    <div className="space-y-3">
      {!effectiveReadOnly && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} /> 행 추가
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            <Copy size={16} /> 복사
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            <Download size={16} /> CSV 다운로드
          </button>
          <div className="text-xs text-gray-500 flex items-center ml-auto">
            <Upload size={14} className="mr-1" />
            엑셀에서 복사 후 테이블에 붙여넣기 가능
          </div>
        </div>
      )}

      <div 
        ref={tableRef}
        className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm"
        onPaste={handlePaste}
      >
        <table className="w-full border-collapse min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 border-b-2 border-r border-gray-300 w-16 bg-gray-50">
                #
              </th>
              {columns.map(col => (
                <th
                  key={col.id}
                  className="px-4 py-3 pr-6 relative text-left text-xs font-bold text-gray-700 border-b-2 border-r border-gray-300 last:border-r-0 bg-gray-50"
                  style={{ width: colWidths[col.id] ?? 150, minWidth: colWidths[col.id] ?? 150 }}
                >
                  {col.label}
                  {col.required && <span className="text-red-500 ml-1">*</span>}
                  {!effectiveReadOnly && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        resizeStateRef.current = {
                          colId: col.id,
                          startX: e.clientX,
                          startWidth: colWidths[col.id] ?? 150,
                        };
                      }}
                      className="absolute top-0 right-0 h-full w-2 cursor-col-resize"
                      title="드래그하여 너비 조절"
                    />
                  )}
                </th>
              ))}
              {!effectiveReadOnly && (
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 border-b-2 border-gray-300 w-20 bg-gray-50">
                  삭제
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const errors = validateRow(row);
              const hasError = errors.length > 0;
              
              return (
                <tr 
                  key={row.id} 
                  className={`hover:bg-indigo-50/30 transition-colors ${hasError ? 'bg-red-50' : 'bg-white'}`}
                >
                  <td className="px-4 py-2 text-sm text-gray-600 border-b border-r border-gray-200 text-center font-medium">
                    {idx + 1}
                  </td>
                  {columns.map(col => (
                    <td
                      key={col.id}
                      className="border-b border-r border-gray-200 last:border-r-0 p-0"
                      style={{ width: colWidths[col.id] ?? 150, minWidth: colWidths[col.id] ?? 150 }}
                    >
                      {renderCell(row, col)}
                    </td>
                  ))}
                  {!effectiveReadOnly && (
                    <td className="px-4 py-2 border-b border-gray-200 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                        title="행 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          데이터가 없습니다. "행 추가" 버튼을 클릭하거나 엑셀에서 데이터를 복사하여 붙여넣으세요.
        </div>
      )}

      <div className="text-xs text-gray-500">
        총 {rows.length}개 행 (최소: {minRows}, 최대: {maxRows})
      </div>
    </div>
  );
};

export default TableEditor;
