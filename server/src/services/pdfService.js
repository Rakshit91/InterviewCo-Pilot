const pdfModule = require('pdf-parse');

/**
 * Extract text from a PDF Buffer
 * Supports both pdf-parse v1 (function) and v2 (PDFParse class)
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromPDF(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF file buffer received');
  }

  let text = '';

  try {
    if (typeof pdfModule === 'function') {
      // pdf-parse v1.x
      const data = await pdfModule(buffer);
      text = data.text || '';
    } else if (pdfModule.PDFParse) {
      // pdf-parse v2.x
      const parser = new pdfModule.PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = typeof result === 'string' ? result : (result?.text || JSON.stringify(result));
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy().catch(() => {});
        }
      }
    } else if (pdfModule.default) {
      if (typeof pdfModule.default === 'function') {
        const data = await pdfModule.default(buffer);
        text = data.text || '';
      } else if (pdfModule.default.PDFParse) {
        const parser = new pdfModule.default.PDFParse({ data: buffer });
        const result = await parser.getText();
        text = typeof result === 'string' ? result : (result?.text || '');
        if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
      }
    }

    // Clean up text
    const cleanedText = (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('PDF appears to contain no readable text (it may be scanned or empty).');
    }

    return cleanedText;
  } catch (error) {
    console.error('[PDF Service] Error parsing PDF buffer:', error.message);
    throw new Error(`Failed to parse PDF text: ${error.message}`);
  }
}

module.exports = {
  extractTextFromPDF
};
