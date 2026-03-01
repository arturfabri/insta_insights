/**
 * PDF exporter — captures the `#pdf-export-content` DOM element with
 * html2canvas and saves it as an A4 PDF using jsPDF.
 *
 * Usage: render your content inside a div with id="pdf-export-content",
 * then call exportBriefsToPdf().
 */

import type { Goal } from '@/types/database'

export async function exportBriefsToPdf(goal: Goal): Promise<void> {
  const element = document.getElementById('pdf-export-content')
  if (!element) {
    console.error('[pdfExporter] #pdf-export-content element not found in DOM')
    return
  }

  // Dynamic imports keep these heavy libs out of the initial bundle
  const [html2canvasModule, jsPDFModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const html2canvas = html2canvasModule.default
  const { jsPDF } = jsPDFModule

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth  = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth   = pageWidth
  const imgHeight  = (canvas.height * pageWidth) / canvas.width

  let heightLeft = imgHeight
  let position   = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const goalLabel = goal === 'growth' ? 'growth' : 'leads'
  pdf.save(`insta-insights-briefs-${goalLabel}-${Date.now()}.pdf`)
}
