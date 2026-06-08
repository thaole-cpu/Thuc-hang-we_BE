import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelBaseService {
  async exportData(data: any[], fieldsToExport: string[]): Promise<Buffer> {
    if (!data || data.length === 0) {
      throw new BadRequestException('Không có dữ liệu để xuất');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('FULL_DATA');

    worksheet.columns = fieldsToExport.map((field) => ({
      header: field.toUpperCase(),
      key: field,
      width: 25,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    worksheet.addRows(data);

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          (cell as any).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F4FF' },
          };
        }
      });
    });

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async previewImport(
    buffer: any,
    mapping: Record<string, string>,
    requiredFields: string[],
    uniqueFields: string[] = [], // ← field nào không được trùng trong file
  ): Promise<any> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File Excel trống hoặc không hợp lệ');

    const headers: string[] = [];
    const previewResults: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    // Track giá trị đã xuất hiện để detect trùng trong file
    const seenValues: Record<string, Set<string>> = {};
    uniqueFields.forEach(f => { seenValues[f] = new Set(); });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value?.toString().trim() || '';
        });
      } else {
        const rowData: any = {};
        const errors: string[] = [];
        let isValid = true;

        Object.keys(mapping).forEach((excelColumnName) => {
          const dbField = mapping[excelColumnName];
          const colIndex = headers.indexOf(excelColumnName);
          let cellValue = colIndex > 0 ? row.getCell(colIndex).value : null;

          if (cellValue && typeof cellValue === 'object') {
            if ('richText' in cellValue) {
              cellValue = (cellValue as any).richText.map((rt: any) => rt.text).join('');
            } else if ('result' in cellValue) {
              cellValue = (cellValue as any).result;
            } else if ('text' in cellValue) {
              cellValue = (cellValue as any).text;
            }
          }

          const finalValue = cellValue != null ? cellValue.toString().trim() : '';
          rowData[dbField] = finalValue;

          // Check bắt buộc
          if (requiredFields.includes(dbField) && !finalValue) {
            isValid = false;
            errors.push(`Thiếu dữ liệu bắt buộc ở cột "${excelColumnName}"`);
          }

          // Check trùng trong file
          if (uniqueFields.includes(dbField) && finalValue) {
            const normalizedVal = finalValue.toLowerCase();
            if (seenValues[dbField].has(normalizedVal)) {
              isValid = false;
              errors.push(`Trùng lặp trong file: "${excelColumnName}" có giá trị "${finalValue}" đã xuất hiện ở dòng trước`);
            } else {
              seenValues[dbField].add(normalizedVal);
            }
          }
        });

        if (isValid) validCount++;
        else invalidCount++;

        previewResults.push({ rowNumber, data: rowData, isValid, errors });
      }
    });

    return {
      totalRows: previewResults.length,
      validCount,
      invalidCount,
      previewData: previewResults,
    };
  }
}