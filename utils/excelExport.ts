import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Customer, CustomerTransaction, PartnerTransaction, InventoryTransaction, Company, FinanceCategory, InventoryItem } from '../types';

export const exportCustomerDebtToExcel = async (
  customer: Customer,
  company: Company | null,
  customerTransactions: CustomerTransaction[],
  partnerTransactions: PartnerTransaction[],
  inventoryTransactions: InventoryTransaction[],
  financeCategories: FinanceCategory[],
  inventoryItems: InventoryItem[],
  startDate?: string,
  endDate?: string
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cong No Khach Hang');

  // Set default column widths
  worksheet.columns = [
    { width: 12 }, // Thời gian
    { width: 15 }, // Mã
    { width: 35 }, // Diễn giải
    { width: 8 },  // ĐVT
    { width: 8 },  // SL
    { width: 15 }, // Giá bán/trả
    { width: 15 }, // Thành tiền
    { width: 15 }, // Ghi nợ
    { width: 15 }, // Ghi có
    { width: 25 }, // Ghi chú
  ];

  // Helper for formatting currency
  const formatNum = (num: number) => num;

  // Header 1: Company Info
  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = company?.exportCompanyName || company?.name || 'Tên công ty';
  worksheet.getCell('A1').font = { bold: true, size: 12 };

  worksheet.mergeCells('A2:E2');
  worksheet.getCell('A2').value = `Mst: ${company?.taxCode || ''}`;
  
  worksheet.mergeCells('A3:E3');
  worksheet.getCell('A3').value = `Địa chỉ: ${company?.address || ''}`;
  
  worksheet.mergeCells('A4:E4');
  worksheet.getCell('A4').value = `Sđt: ${company?.phone || ''}`;

  // Title
  worksheet.mergeCells('A6:J6');
  worksheet.getCell('A6').value = 'Công nợ chi tiết khách hàng';
  worksheet.getCell('A6').font = { bold: true, size: 16 };
  worksheet.getCell('A6').alignment = { horizontal: 'center' };

  // Determine date range (min/max date of transactions)
  let allDates: string[] = [];
  
  // Collect all relevant transactions
  interface FormattedRow {
    date: Date;
    ma: string;
    dienGiai: string;
    dvt: string;
    sl: number | string;
    giaBan: number | string;
    thanhTien: number | string;
    ghiNo: number | string;
    ghiCo: number | string;
    ghiChu?: string;
    groupId?: string;
  }
  let rowsData: FormattedRow[] = [];
  let tongGhiNo = 0;
  let tongGhiCo = 0;

  // Filter conditions
  const isAfterOrEqual = (d: string, start?: string) => !start || new Date(d).getTime() >= new Date(start).getTime();
  const isBeforeOrEqual = (d: string, end?: string) => !end || new Date(d).getTime() <= new Date(end).getTime();
  const isBefore = (d: string, start?: string) => start && new Date(d).getTime() < new Date(start).getTime();

  let accumulatedDebtBeforeStart = customer.initialDebt || 0;

  // 1. Thu (Ghi có)
  const thuTxs = customerTransactions.filter(t => t.customerId === customer.id && t.paidAmount > 0);
  thuTxs.forEach(t => {
    if (isBefore(t.date, startDate)) {
      accumulatedDebtBeforeStart -= t.paidAmount;
    } else if (isAfterOrEqual(t.date, startDate) && isBeforeOrEqual(t.date, endDate)) {
      allDates.push(t.date);
      rowsData.push({
        date: new Date(t.date),
        ma: '',
        dienGiai: t.note || 'Thanh toán',
        dvt: '',
        sl: '',
        giaBan: '',
        thanhTien: '',
        ghiNo: '',
        ghiCo: t.paidAmount,
        ghiChu: ''
      });
      tongGhiCo += t.paidAmount;
    }
  });

  // 2. Chi (Ghi nợ - PartnerTransaction chi cho công trình)
  // Loại bỏ các giao dịch có productId = 'inventory_export' vì đã được tính ở phần 3 (Chi tiết xuất kho)
  const chiTxs = partnerTransactions.filter(t => 
    t.customerId === customer.id && 
    t.productId !== 'inventory_export' && 
    (t.purchaseAmount > 0 || (financeCategories.some(c => c.id === t.productId) && t.paidAmount > 0))
  );
  chiTxs.forEach(t => {
    const amount = t.purchaseAmount > 0 ? t.purchaseAmount : t.paidAmount;
    if (isBefore(t.date, startDate)) {
      accumulatedDebtBeforeStart += amount;
    } else if (isAfterOrEqual(t.date, startDate) && isBeforeOrEqual(t.date, endDate)) {
      allDates.push(t.date);
      rowsData.push({
        date: new Date(t.date),
        ma: '',
        dienGiai: t.note || 'Chi phí khác',
        dvt: '',
        sl: '',
        giaBan: '',
        thanhTien: '',
        ghiNo: amount,
        ghiCo: '',
        ghiChu: ''
      });
      tongGhiNo += amount;
    }
  });

  // 3. Inventory (Export to customer) -> Ghi nợ
  const invTxs = inventoryTransactions.filter(t => t.type === 'EXPORT' && t.customerId === customer.id);
  
  // Group by linkedTxId or date if linkedTxId is missing
  const groupedInvTxs: { [key: string]: InventoryTransaction[] } = {};
  invTxs.forEach(t => {
    const key = t.linkedTxId || t.date;
    if (!groupedInvTxs[key]) {
      groupedInvTxs[key] = [];
    }
    groupedInvTxs[key].push(t);
  });

  Object.entries(groupedInvTxs).forEach(([key, group]) => {
    if (group.length === 0) return;
    const firstTx = group[0];
    
    let totalGroupAmount = 0;
    group.forEach(t => totalGroupAmount += t.totalAmount);

    if (isBefore(firstTx.date, startDate)) {
      accumulatedDebtBeforeStart += totalGroupAmount;
    } else if (isAfterOrEqual(firstTx.date, startDate) && isBeforeOrEqual(firstTx.date, endDate)) {
      allDates.push(firstTx.date);
      tongGhiNo += totalGroupAmount;

      // Detail rows, putting total and date on the first row
      group.forEach((t, idx) => {
        const invItem = inventoryItems.find(i => i.id === t.itemId);
        rowsData.push({
          date: idx === 0 ? new Date(firstTx.date) : new Date(t.date), // Date only really matters for first row, but we keep it for sorting
          ma: invItem?.code || t.itemId.substring(0,8), 
          dienGiai: invItem?.name || 'Mặt hàng',
          dvt: invItem?.unit || '',
          sl: t.quantity,
          giaBan: t.unitPrice,
          thanhTien: t.totalAmount,
          ghiNo: idx === 0 ? totalGroupAmount : '', // Only show total on the first row
          ghiCo: '',
          ghiChu: t.note || '', // Include note for detail row if needed
          groupId: key
        });
      });
    }
  });

  // Sort rows by date, and keep 'Bán hàng' rows before items of same date
  rowsData.sort((a, b) => {
    const dDiff = a.date.getTime() - b.date.getTime();
    if (dDiff !== 0) return dDiff;
    return 0;
  });

  // Format date range
  let dateRangeStr = '';
  if (startDate || endDate) {
    const sDate = startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '...';
    const eDate = endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '...';
    dateRangeStr = `Từ ngày ${sDate} đến ngày ${eDate}`;
  } else if (allDates.length > 0) {
    const dates = allDates.map(d => new Date(d).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    dateRangeStr = `Từ ngày ${minDate.toLocaleDateString('vi-VN')} đến ngày ${maxDate.toLocaleDateString('vi-VN')}`;
  }
  
  worksheet.mergeCells('A7:J7');
  worksheet.getCell('A7').value = dateRangeStr;
  worksheet.getCell('A7').alignment = { horizontal: 'center' };

  const noDauKy = accumulatedDebtBeforeStart;
  const noCuoiKy = noDauKy + tongGhiNo - tongGhiCo;

  // Customer Info block (Row 9-12)
  worksheet.getCell('A9').value = 'Khách hàng:';
  worksheet.getCell('A9').font = { bold: true };
  worksheet.getCell('B9').value = customer.name;
  worksheet.getCell('B9').font = { bold: true };
  
  worksheet.getCell('F9').value = 'Nợ đầu kỳ:';
  worksheet.getCell('F9').font = { bold: true };
  worksheet.getCell('G9').value = noDauKy;
  worksheet.getCell('G9').font = { bold: true };
  worksheet.getCell('G9').numFmt = '#,##0';

  worksheet.getCell('A10').value = 'Địa chỉ:';
  worksheet.getCell('B10').value = customer.address || '';
  
  worksheet.getCell('F10').value = 'Phát sinh trong kỳ:';
  worksheet.getCell('F10').font = { bold: true };
  worksheet.getCell('G10').value = tongGhiNo;
  worksheet.getCell('G10').font = { bold: true };
  worksheet.getCell('G10').numFmt = '#,##0';

  worksheet.getCell('A11').value = 'Điện thoại:';
  worksheet.getCell('B11').value = customer.phone || '';
  
  worksheet.getCell('F11').value = 'Thanh toán:';
  worksheet.getCell('F11').font = { bold: true };
  worksheet.getCell('G11').value = tongGhiCo;
  worksheet.getCell('G11').font = { bold: true };
  worksheet.getCell('G11').numFmt = '#,##0';

  worksheet.getCell('F12').value = 'Nợ cuối kỳ:';
  worksheet.getCell('F12').font = { bold: true, color: { argb: 'FFFF0000' } };
  worksheet.getCell('G12').value = noCuoiKy;
  worksheet.getCell('G12').font = { bold: true, color: { argb: 'FFFF0000' } };
  worksheet.getCell('G12').numFmt = '#,##0';

  // Note: user specifically requested NO borders for this block
  
  // Table Headers
  const headers = ['Thời gian', 'Mã', 'Diễn giải', 'ĐVT', 'SL', 'Giá bán/trả', 'Thành tiền', 'Ghi nợ', 'Ghi có', 'Ghi chú'];
  const headerRow = worksheet.getRow(14);
  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  
  headers.forEach((_, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' } // Light green as in image
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add Data Rows
  let currentRow = 15;
  const groupMergeMap = new Map<string, { start: number, end: number }>();

  rowsData.forEach(row => {
    const r = worksheet.getRow(currentRow);
    // Determine if we should show date: 
    // Either it's a standalone payment/cost row (ma === ''), or it's the first item of an export (has ghiNo)
    const showDate = row.ma === '' || row.ghiNo !== '';
    const isHeaderRow = row.ma === '';

    r.values = [
      showDate ? row.date.toLocaleDateString('vi-VN') : '',
      row.ma,
      row.dienGiai,
      row.dvt,
      row.sl !== '' ? row.sl : null,
      row.giaBan !== '' ? row.giaBan : null,
      row.thanhTien !== '' ? row.thanhTien : null,
      row.ghiNo !== '' ? row.ghiNo : null,
      row.ghiCo !== '' ? row.ghiCo : null,
      row.ghiChu || ''
    ];
    
    if (isHeaderRow) {
      r.font = { bold: true };
    }

    if (row.groupId) {
      if (!groupMergeMap.has(row.groupId)) {
        groupMergeMap.set(row.groupId, { start: currentRow, end: currentRow });
      } else {
        groupMergeMap.get(row.groupId)!.end = currentRow;
      }
    }

    // Borders & Number Formatting
    for (let i = 1; i <= 10; i++) {
      const cell = r.getCell(i);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // Numbers formatting
      if (i >= 5 && i <= 9) {
        if (cell.value) {
          cell.numFmt = '#,##0';
        }
      }
    }
    
    currentRow++;
  });

  groupMergeMap.forEach((range) => {
    if (range.end > range.start) {
      worksheet.mergeCells(`J${range.start}:J${range.end}`);
      worksheet.getCell(`J${range.start}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Cong_No_${customer.name.replace(/\s+/g, '_')}.xlsx`);
};
