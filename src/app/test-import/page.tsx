"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button, Table, message, Space, Select, Card, Typography, Divider, InputNumber } from "antd";
import { UploadOutlined, DownloadOutlined, FileExcelOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";

// ===== MOCK DATA TYPES =====
interface MockQuotationRow {
  key: string;
  productId: string;
  itemDescriptions: Array<{ name: string; value: string }>;
  quantity: number;
  unitPrice: number;
  unit: string;
  origin: string;
  chanel: number;
  deliveryTime: string;
  waranty: string;
  tax: number;
  currency: 'USD' | 'VND';
  total?: number;
  // Base price in USD to prevent double conversion when toggling display currency
  baseUSD?: number;
}

interface MockClient {
  clientCode: string;
  projectName: string;
  personalMobile: string;
  currency: 'USD' | 'VND';
}

// ===== IMPROVED CSV PARSER =====
const parseCSVFile = async (file: File): Promise<{
  dataRow: MockQuotationRow[];
  client: MockClient;
}> => {
  const text = await file.text();
  console.log("CSV file content:", text.substring(0, 500) + "...");
  
  const lines = text.split('\n').filter(line => line.trim());
  console.log("CSV lines:", lines.length, "First few lines:", lines.slice(0, 3));
  
  if (lines.length < 2) {
    throw new Error('File CSV không có dữ liệu');
  }

  // Improved CSV parsing - handle quoted fields properly
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
  console.log("CSV headers:", headers);
  
  // Find column indices with more flexible matching
  const getColIndex = (names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex(h => 
        h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
      if (idx >= 0) {
        console.log(`Found column "${name}" at index ${idx}: "${headers[idx]}"`);
        return idx;
      }
    }
    console.log(`Column not found for: ${names.join(', ')}`);
    return -1;
  };

  const colProductId = getColIndex(['productid', 'product id', 'id', 'mã sp']);
  const colDescription = getColIndex(['itemdescription', 'item description', 'description', 'mô tả']);
  const colQuantity = getColIndex(['quantity', 'số lượng', 'qty', 'sl']);
  const colUnit = getColIndex(['unit', 'đơn vị', 'dv']);
  const colUnitPrice = getColIndex(['unitprice', 'unit price', 'price', 'đơn giá', 'cost', 'giá']);
  const colOrigin = getColIndex(['origin', 'xuất xứ', 'code/origin', 'code']);
  const colChannels = getColIndex(['channels', 'chanel', 'kênh', 'channel']);
  const colDelivery = getColIndex(['delivery', 'thời gian giao hàng', 'delivery time']);
  const colWarranty = getColIndex(['warranty', 'bảo hành', 'warranty']);
  const colTax = getColIndex(['tax', 'vat', 'thuế', 'vat rate']);

  console.log("Column indices:", {
    colProductId, colDescription, colQuantity, colUnit, colUnitPrice,
    colOrigin, colChannels, colDelivery, colWarranty, colTax
  });

  // Detect currency from headers
  let detectedCurrency: 'USD' | 'VND' = 'VND';
  const headerText = headers.join(' ').toLowerCase();
  if (headerText.includes('usd') || headerText.includes('$')) {
    detectedCurrency = 'USD';
  }

  // Parse data rows
  const dataRow: MockQuotationRow[] = [];
  console.log("Parsing data rows...");
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    console.log(`Row ${i}:`, values);
    
    if (values.length === 0) continue;
    
    const productId = colProductId >= 0 ? values[colProductId] : `ITEM_${i}`;
    const description = colDescription >= 0 ? values[colDescription] : '';
    const quantity = colQuantity >= 0 ? parseFloat(values[colQuantity].replace(/[^0-9.-]/g, '')) || 0 : 0;
    const unit = colUnit >= 0 ? values[colUnit] : 'pcs';
    const unitPriceStr = colUnitPrice >= 0 ? values[colUnitPrice] : '0';
    const unitPrice = parseFloat(unitPriceStr.replace(/[^0-9.-]/g, '')) || 0;
    const origin = colOrigin >= 0 ? values[colOrigin] : '';
    const channels = colChannels >= 0 ? parseInt(values[colChannels].replace(/[^0-9]/g, '')) || 0 : 0;
    const delivery = colDelivery >= 0 ? values[colDelivery] : '';
    const warranty = colWarranty >= 0 ? values[colWarranty] : '';
    const tax = colTax >= 0 ? parseFloat(values[colTax].replace(/[^0-9.-]/g, '')) || 0 : 0;

    // Parse item descriptions from description field
    const itemDescriptions = description
      .split('|')
      .map(desc => desc.trim())
      .filter(desc => desc.includes(':'))
      .map(desc => {
        const [name, ...rest] = desc.split(':');
        return { name: name.trim(), value: rest.join(':').trim() };
      });

    // If no structured descriptions, create a simple one
    if (itemDescriptions.length === 0 && description) {
      itemDescriptions.push({ name: 'Description', value: description });
    }

    // Detect currency from unit price column
    if (colUnitPrice >= 0) {
      const priceText = values[colUnitPrice].toLowerCase();
      if (priceText.includes('usd') || priceText.includes('$')) {
        detectedCurrency = 'USD';
      } else if (priceText.includes('vnd') || priceText.includes('đ')) {
        detectedCurrency = 'VND';
      }
    }

    // Only add rows with meaningful data
    if (productId || description || quantity > 0 || unitPrice > 0) {
      const rowData = {
        key: String(i),
        productId: productId || `ITEM_${i}`,
        itemDescriptions,
        quantity,
        unitPrice,
        unit,
        origin,
        chanel: channels,
        deliveryTime: delivery,
        waranty: warranty,
        tax,
        currency: detectedCurrency,
        total: quantity * unitPrice
      };
      console.log(`Adding row ${i}:`, rowData);
      dataRow.push(rowData);
    } else {
      console.log(`Skipping empty row ${i}`);
    }
  }

  if (dataRow.length === 0) {
    throw new Error('Không tìm thấy dữ liệu hợp lệ trong file CSV');
  }

  return {
    dataRow,
    client: {
      clientCode: "C001",
      projectName: "LED Installation Project",
      personalMobile: "0123456789",
      currency: detectedCurrency
    }
  };
};

// Currency helpers
const VND_PER_USD = 23000;
const toUSD = (value: number, currency: 'USD' | 'VND') => (currency === 'VND' ? value / VND_PER_USD : value);
const fromUSD = (usd: number, currency: 'USD' | 'VND') => (currency === 'VND' ? usd * VND_PER_USD : usd);

// --- CSV helpers for exporting without extra deps ---
function rowsToCsv(rows: MockQuotationRow[], client: MockClient, isVn: boolean): string {
  // Company information header
  const companyInfo = [
    `Company Name,${client.projectName}`,
    `Client Code,${client.clientCode}`,
    `Mobile,${client.personalMobile}`,
    `Currency,${client.currency}`,
    `Export Date,${new Date().toLocaleDateString()}`,
    '', // Empty line separator
  ];

  // Data header
  const header = [
    'Product ID',
    'Item Description',
    'Quantity',
    'Unit',
    `Unit Price (${isVn ? 'VND' : 'USD'})`,
    'Origin',
    'Channels',
    'Delivery (days)',
    'Warranty',
    'Tax (%)',
  ];

  const escape = (v: any) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const lines = [
    ...companyInfo,
    header.join(','),
  ];

  for (const r of rows) {
    const desc = r.itemDescriptions.map(d => `${d.name}: ${d.value}`).join(' | ');
    const displayPrice = fromUSD(Number(r.baseUSD || r.unitPrice || 0), isVn ? 'VND' : 'USD');
    lines.push([
      r.productId,
      desc,
      r.quantity,
      r.unit,
      isVn ? Math.round(displayPrice) : Number(displayPrice).toFixed(2),
      r.origin,
      r.chanel,
      r.deliveryTime,
      r.waranty,
      r.tax,
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const exportToExcelMock = (data: MockQuotationRow[], client: MockClient) => {
  const isVn = client.currency === 'VND';
  const csv = rowsToCsv(data, client, isVn);
  const fileName = `Quotation_${client.clientCode || 'Client'}_${client.currency}.csv`;
  downloadCsv(fileName, csv);
  message.success(`Đã export ${data.length} dòng dữ liệu (${client.currency})`);
};

// ===== MAIN COMPONENT =====
export default function TestImportPage() {
  const [rows, setRows] = useState<MockQuotationRow[]>([]);
  const [client, setClient] = useState<MockClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVn, setIsVn] = useState(true);
  const [templateCurrency, setTemplateCurrency] = useState<'USD' | 'VND'>('VND');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ❗ NGUYÊN NHÂN LỖI DOUBLE CONVERSION:
  // 1. parseExcelFileDynamic đã tự động convert giá theo isVn trong hàm
  // 2. Sau khi import, useEffect([isVn]) lại chạy và convert thêm lần nữa
  // 3. Kết quả: giá bị convert 2 lần → sai giá
  
  // 🔧 CÁCH KHẮC PHỤC:
  // 1. Bỏ ?? false ở usePrevious để tránh trigger useEffect lần đầu
  // 2. Hoặc thêm flag để skip conversion lần đầu sau import
  // 3. Hoặc parseExcelFileDynamic không nên convert, để UI tự xử lý

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      message.warning("Vui lòng chọn file Excel/CSV");
      return;
    }

    setLoading(true);
    try {
      let dataRow: MockQuotationRow[];
      let clientData: MockClient;

      console.log("Importing file:", file.name, "Type:", file.type, "Size:", file.size);

      // Check file type and parse accordingly
      if (file.name.toLowerCase().endsWith('.csv')) {
        console.log("Parsing CSV file...");
        const result = await parseCSVFile(file);
        console.log("CSV parse result:", result);
        dataRow = result.dataRow;
        clientData = result.client;
      } else {
        console.log("Using mock data for Excel file...");
        // For Excel files, use mock data for now
        const mockData = {
          dataRow: [
            {
              key: "1",
              productId: "LED001",
              itemDescriptions: [
                { name: "Model", value: "LED Light Strip" },
                { name: "Power Consumption", value: "10" },
                { name: "Color", value: "RGB" },
                { name: "CRI", value: "90" }
              ],
              quantity: 10,
              unitPrice: 200000,
              unit: "pcs",
              origin: "China",
              chanel: 3,
              deliveryTime: "7",
              waranty: "2 years",
              tax: 8,
              currency: 'VND' as const,
              total: 100
            }
          ],
          client: {
            clientCode: "C001",
            projectName: "LED Installation Project",
            personalMobile: "0123456789",
            currency: 'VND' as const
          }
        };
        dataRow = mockData.dataRow;
        clientData = mockData.client;
      }

      console.log("Data rows before normalization:", dataRow);

      // Normalize data: convert all prices to baseUSD for consistent conversion
      const normalized = dataRow.map(r => {
        const baseUSD = toUSD(Number(r.unitPrice || 0), r.currency);
        return { ...r, baseUSD } as MockQuotationRow;
      });

      console.log("Normalized data:", normalized);

      setRows(normalized);
      setClient(clientData);
      
      // Set template currency based on detected currency from file
      setTemplateCurrency(clientData.currency);
      setIsVn(clientData.currency === 'VND');
      
      message.success(`Import thành công ${dataRow.length} dòng dữ liệu (${clientData.currency})`);
    } catch (error) {
      console.error("Import error:", error);
      message.error("Import thất bại: " + (error as Error).message);
    } finally {
      setLoading(false);
      // Reset input so selecting the same file again will trigger onChange
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      message.warning("Không có dữ liệu để export");
      return;
    }
    
    if (!client) {
      message.warning("Không có thông tin client");
      return;
    }

    exportToExcelMock(rows, client);
  };

  const handleExportTemplate = () => {
    const isTemplateVn = templateCurrency === 'VND';
    
    // Company information for template
    const companyInfo = [
      `Company Name,Sample Company`,
      `Client Code,TEMPLATE`,
      `Mobile,0123456789`,
      `Currency,${templateCurrency}`,
      `Export Date,${new Date().toLocaleDateString()}`,
      `Template Type,${templateCurrency} Template`,
      '', // Empty line separator
    ];

    const header = [
      'Item Description',
      'Product ID',
      'Unit',
      'Quantity',
      `Unit Price (${isTemplateVn ? 'VND' : 'USD'})`,
      'Origin',
      'Channels',
      'Delivery (days)',
      'Warranty',
      'Tax (%)',
    ];
    
    const rowsCsv = (isTemplateVn ? [
      ['Model: LED Light Strip | Power Consumption: 10 | Color: RGB | CRI: 90','LED001','pcs',10,200000,'China',3,7,'2 years',8],
      ['Model: DMX Controller | Power Consumption: 5 | Channels: 512','CTRL002','pcs',5,100000,'Germany',0,14,'3 years',8],
    ] : [
      ['Model: LED Light Strip | Power Consumption: 10 | Color: RGB | CRI: 90','LED001','pcs',10,8.7,'China',3,7,'2 years',0],
      ['Model: DMX Controller | Power Consumption: 5 | Channels: 512','CTRL002','pcs',5,4.35,'Germany',0,14,'3 years',0],
    ]) as Array<Array<string|number>>;
    
    const escape = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    
    const csv = [
      ...companyInfo,
      header.join(','),
      ...rowsCsv.map(r => r.map(escape).join(','))
    ].join('\n');
    
    const fileName = `Quotation_Template_${templateCurrency}.csv`;
    downloadCsv(fileName, csv);
    message.success(`Đã export template (${templateCurrency})`);
  };

  const columns: ColumnsType<MockQuotationRow> = [
    {
      title: "Product ID",
      dataIndex: "productId",
      key: "productId",
      width: 100,
    },
    {
      title: "Item Description",
      dataIndex: "itemDescriptions",
      key: "itemDescriptions",
      width: 200,
      render: (descriptions: Array<{ name: string; value: string }>) => (
        <div>
          {descriptions.map((desc, index) => (
            <div key={index} style={{ fontSize: '12px' }}>
              <strong>{desc.name}:</strong> {desc.value}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
    },
    {
      title: "Unit",
      dataIndex: "unit",
      key: "unit",
      width: 60,
    },
    {
      title: `Unit Price (${templateCurrency})`,
      dataIndex: "unitPrice",
      key: "unitPrice",
      width: 160,
      render: (_: any, record) => {
        const displayPrice = fromUSD(Number(record.baseUSD || record.unitPrice || 0), templateCurrency);
        return (
          <InputNumber
            value={templateCurrency === 'VND' ? Math.round(displayPrice) : Number(displayPrice.toFixed(2))}
            min={0}
            style={{ width: 150 }}
            formatter={(val) => {
              const n = Number(val || 0);
              return templateCurrency === 'VND' ? n.toLocaleString('en-US') : n.toFixed(2);
            }}
            parser={(val) => Number((val || '').toString().replace(/,/g, ''))}
            onChange={(val) => {
              const num = Number(val || 0);
              const newBaseUSD = templateCurrency === 'VND' ? num / VND_PER_USD : num;
              setRows(prev => prev.map(r => r.key === record.key ? { ...r, baseUSD: newBaseUSD, unitPrice: fromUSD(newBaseUSD, r.currency) } : r));
            }}
          />
        );
      },
    },
    {
      title: "Origin",
      dataIndex: "origin",
      key: "origin",
      width: 100,
    },
    {
      title: "Channels",
      dataIndex: "chanel",
      key: "chanel",
      width: 80,
    },
    {
      title: "Delivery (days)",
      dataIndex: "deliveryTime",
      key: "deliveryTime",
      width: 100,
    },
    {
      title: "Warranty",
      dataIndex: "waranty",
      key: "waranty",
      width: 100,
    },
    {
      title: "Tax (%)",
      dataIndex: "tax",
      key: "tax",
      width: 80,
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <Typography.Title level={2}>Test Import/Export Excel</Typography.Title>
        <Typography.Text type="secondary">
          Component test tính năng import/export Excel với giải thích lỗi double conversion
        </Typography.Text>
      </div>

      <Card title="Import/Export Controls" style={{ marginBottom: "24px" }}>
        <Space wrap>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleImport}
          />
          
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={loading}
            onClick={() => fileInputRef.current?.click()}
          >
            Import Excel
          </Button>
          
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={rows.length === 0}
          >
            Export Excel
          </Button>
          
          <Divider type="vertical" />
          
          <Select
            value={templateCurrency}
            onChange={setTemplateCurrency}
            style={{ width: 120 }}
          >
            <Select.Option value="VND">VND Template</Select.Option>
            <Select.Option value="USD">USD Template</Select.Option>
          </Select>
          
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExportTemplate}
          >
            Export Template
          </Button>
        </Space>
      </Card>

      {/* ❗ GIẢI THÍCH LỖI DOUBLE CONVERSION */}
      <Card title="⚠️ Giải thích lỗi Double Conversion" style={{ marginBottom: "24px" }}>
        <Typography.Paragraph>
          <strong>Nguyên nhân lỗi:</strong>
        </Typography.Paragraph>
        <ul>
          <li>
            <strong>Bước 1:</strong> <code>parseExcelFileDynamic</code> đã tự động convert giá theo <code>isVn</code> 
            (VND ↔ USD) trong quá trình parse
          </li>
          <li>
            <strong>Bước 2:</strong> Sau khi import, <code>useEffect([isVn])</code> chạy và convert giá thêm lần nữa
          </li>
          <li>
            <strong>Kết quả:</strong> Giá bị convert 2 lần → sai giá (ví dụ: 100 USD → 2,300,000 VND → 100 USD)
          </li>
        </ul>
        
        <Typography.Paragraph>
          <strong>Cách khắc phục:</strong>
        </Typography.Paragraph>
        <ul>
          <li>
            <strong>Phương án 1:</strong> Bỏ <code>?? false</code> ở <code>usePrevious</code> để tránh trigger useEffect lần đầu
          </li>
          <li>
            <strong>Phương án 2:</strong> Thêm flag <code>skipFirstConversion</code> để bỏ qua conversion lần đầu sau import
          </li>
          <li>
            <strong>Phương án 3:</strong> <code>parseExcelFileDynamic</code> không nên convert, để UI tự xử lý conversion
          </li>
        </ul>
      </Card>

      {/* CLIENT INFO */}
      {client && (
        <Card title="Company Information" style={{ marginBottom: "24px" }}>
          <Space direction="vertical">
            <div><strong>Company Name:</strong> {client.projectName}</div>
            <div><strong>Client Code:</strong> {client.clientCode}</div>
            <div><strong>Mobile:</strong> {client.personalMobile}</div>
            <div><strong>Currency:</strong> {client.currency}</div>
            <div><strong>Template Currency:</strong> {templateCurrency}</div>
          </Space>
        </Card>
      )}

      {/* DATA TABLE */}
      <Card title={`Data Table (${rows.length} rows)`}>
        <Table
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <Link href="/">← Về trang chủ</Link>
      </div>
    </div>
  );
}


