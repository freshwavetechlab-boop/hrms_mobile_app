import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { PayslipDocument } from '../types/domain';

const fileUrl = (path: string) => path.startsWith('file://') ? path : `file://${path}`;
const safeName = (document: PayslipDocument) =>
  (document.fileName || `payslip-${document.employeeCode}-${document.payPeriod}`)
    .replace(/\.html?$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_');

export const payslipExportService = {
  async sharePdf(document: PayslipDocument) {
    const fileName = safeName(document);
    const result = await generatePDF({
      fileName,
      html: document.html,
      shouldPrintBackgrounds: true,
    });
    if (!result.filePath) {
      throw new Error('PAYSLIP_PDF_NOT_CREATED');
    }
    await Share.open({
      failOnCancel: false,
      filename: `${fileName}.pdf`,
      title: 'Download or share payslip PDF',
      type: 'application/pdf',
      url: fileUrl(result.filePath),
      useInternalStorage: true,
    });
  },
};
