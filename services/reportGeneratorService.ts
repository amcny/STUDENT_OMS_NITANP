/**
 * --- Programmatic PDF Report Generator ---
 *
 * This service provides a robust, high-fidelity PDF generation capability
 * using the jsPDF and jsPDF-AutoTable libraries. It is designed to
 * programmatically build the document to match a specific visual template,
 * ensuring a consistent and professional output every time.
 */

import { OutingRecord } from '../types';

// Allow global jsPDF var from CDN
declare var jspdf: any;

// Helper to fetch the logo and convert to Base64 to avoid CORS/timing issues
const getLogoBase64 = async (): Promise<string> => {
    try {
        const response = await fetch('https://mscnitanp.pages.dev/nitanp_logo.png');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Could not fetch logo for PDF report:", error);
        return ''; // Return empty string on failure
    }
};

export const generatePdfReport = async (reportData: any) => {
    const {
        totalStudents,
        onOutingCount,
        overdueLogs,
        todaysStats,
        hostelOccupancy,
        hostelOccupancyTotals,
        studentMap
    } = reportData;

    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });
    
    const logoBase64 = await getLogoBase64();
    
    // --- Page Constants & Styling ---
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const MARGIN = 40;
    let cursorY = MARGIN;

    const COLORS = {
        primaryBlue: '#1F4E79',
        headerBlue: '#002060',
        sectionRed: '#C00000',
        textDark: '#000000',
        textMedium: '#595959',
        textLight: '#7F7F7F',
        borderLight: '#BFBFBF',
        orange: '#ED7D31',
        green: '#70AD47',
        card: {
            totalBg: '#F2F2F2',
            outBg: '#FFF2CC',
            overdueBg: '#F8CBAD',
            onCampusBg: '#C6E0B4',
            localBg: '#DEEBF7',
            nonLocalBg: '#E2D9EE',
            visitorsBg: '#E2D9EE',
        },
        table: {
            headerBg: '#F2F2F2',
            totalBg: '#D9D9D9',
            overdueHeaderBg: '#FCE4D6',
        }
    };

    // --- Helper Functions for Drawing ---
    const drawPageHeader = () => {
        cursorY = MARGIN;
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', MARGIN, MARGIN - 15, 45, 45);
        }
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(COLORS.headerBlue);
        doc.text('NATIONAL INSTITUTE OF TECHNOLOGY', MARGIN + 55, MARGIN);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(12);
        doc.text('ANDHRA PRADESH', MARGIN + 55, MARGIN + 17);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(COLORS.textDark);
        doc.text('OUTING REPORT', PAGE_WIDTH - MARGIN, MARGIN, { align: 'right' });
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(COLORS.textMedium);
        const now = new Date();
        doc.text(now.toLocaleDateString('en-GB'), PAGE_WIDTH - MARGIN, MARGIN + 15, { align: 'right' });
        doc.text(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase(), PAGE_WIDTH - MARGIN, MARGIN + 28, { align: 'right' });

        cursorY = MARGIN + 40;
        doc.setDrawColor(COLORS.textDark);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);
    };

    const drawSectionHeader = (index: number, title: string, color: string) => {
        cursorY += 25;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(color);
        doc.text(`${index}. ${title.toUpperCase()}`, MARGIN, cursorY);
        cursorY += 5;
        doc.setDrawColor(color);
        doc.setLineWidth(1.5);
        doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY);
        cursorY += 15;
    };
    
    const drawStatCard = (x: number, y: number, width: number, height: number, title: string, value: string | number, bgColor: string, borderColor: string = COLORS.textLight) => {
        const cornerRadius = 5;
        doc.setFillColor(bgColor);
        doc.setDrawColor(borderColor);
        doc.setLineWidth(0.75);
        doc.roundedRect(x, y, width, height, cornerRadius, cornerRadius, 'FD');

        doc.setFontSize(8);
        doc.setTextColor(COLORS.textLight);
        doc.setFont('Helvetica', 'normal');
        doc.text(title.toUpperCase(), x + 10, y + 15);
        
        doc.setFontSize(36);
        doc.setTextColor(COLORS.textDark);
        doc.setFont('Helvetica', 'bold');
        // Align text to the bottom right for the desired effect
        doc.text(String(value), x + 10, y + height - 10);
    };

    const drawPageFooter = (pageNumber: number, totalPages: number) => {
        const footerY = PAGE_HEIGHT - 30;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.textMedium);
        doc.text('Generated automatically by Outing Management System', MARGIN, footerY + 5);
        doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_WIDTH - MARGIN, footerY + 5, { align: 'right' });
    };
    
    // --- Start Building the PDF ---
    drawPageHeader();

    // --- Section 1: Executive Summary ---
    drawSectionHeader(1, 'EXECUTIVE SUMMARY', COLORS.primaryBlue);
    const cardWidth = (PAGE_WIDTH - 2 * MARGIN - 3 * 10) / 4;
    const cardHeight = 60;
    drawStatCard(MARGIN, cursorY, cardWidth, cardHeight, 'Total Students', totalStudents, COLORS.card.totalBg);
    drawStatCard(MARGIN + cardWidth + 10, cursorY, cardWidth, cardHeight, 'Currently Out', onOutingCount, COLORS.card.outBg, COLORS.orange);
    drawStatCard(MARGIN + 2 * (cardWidth + 10), cursorY, cardWidth, cardHeight, 'Total Overdue', overdueLogs.length, COLORS.card.overdueBg, COLORS.sectionRed);
    drawStatCard(MARGIN + 3 * (cardWidth + 10), cursorY, cardWidth, cardHeight, 'On Campus', totalStudents - onOutingCount, COLORS.card.onCampusBg, COLORS.green);
    cursorY += cardHeight;
    
    // --- Section 2: Today's Activity ---
    drawSectionHeader(2, "TODAY'S ACTIVITY", COLORS.primaryBlue);
    const activityCardWidth = (PAGE_WIDTH - 2 * MARGIN - 2 * 10) / 3;
    drawStatCard(MARGIN, cursorY, activityCardWidth, cardHeight, 'Local Outings', todaysStats.localOutingsToday, COLORS.card.localBg, '#2E75B6');
    drawStatCard(MARGIN + activityCardWidth + 10, cursorY, activityCardWidth, cardHeight, 'Non-Local Outings', todaysStats.nonLocalOutingsToday, COLORS.card.nonLocalBg, '#5A3A85');
    drawStatCard(MARGIN + 2 * (activityCardWidth + 10), cursorY, activityCardWidth, cardHeight, 'Visitors Today', todaysStats.visitorsToday, COLORS.card.visitorsBg, COLORS.textLight);
    cursorY += cardHeight;

    // --- Section 3: Hostel Occupancy Status ---
    drawSectionHeader(3, 'HOSTEL OCCUPANCY STATUS', COLORS.primaryBlue);
    (doc as any).autoTable({
        startY: cursorY,
        head: [['HOSTEL NAME', 'TOTAL REGISTERED', 'CURRENTLY OUT', 'CURRENTLY PRESENT']],
        body: hostelOccupancy.map((row: any) => [
            row.hostel, row.total, row.out, row.present
        ]),
        foot: [[
            'TOTAL',
            hostelOccupancyTotals.total,
            hostelOccupancyTotals.out,
            hostelOccupancyTotals.present
        ]],
        theme: 'grid',
        headStyles: {
            fillColor: COLORS.table.headerBg, textColor: COLORS.textDark, fontStyle: 'bold', halign: 'center', fontSize: 9, lineColor: COLORS.borderLight, lineWidth: 0.5,
        },
        footStyles: {
            fillColor: COLORS.table.totalBg, textColor: COLORS.textDark, fontStyle: 'bold', halign: 'center', lineColor: COLORS.borderLight, lineWidth: 0.5,
        },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
        styles: { cellPadding: 6, fontSize: 9, valign: 'middle', lineColor: COLORS.borderLight, font: 'Helvetica' },
        didParseCell: (data: any) => {
            if (data.section === 'head') {
                if (data.column.index === 2) data.cell.styles.textColor = COLORS.orange;
                if (data.column.index === 3) data.cell.styles.textColor = COLORS.green;
            }
            if (data.section === 'body') {
                if (data.column.index === 2 && data.cell.raw > 0) data.cell.styles.textColor = COLORS.orange;
                if (data.column.index === 3) data.cell.styles.textColor = COLORS.green;
            }
        },
        didDrawPage: (data: any) => { cursorY = data.cursor.y; }
    });
    cursorY = (doc as any).autoTable.previous.finalY;

    // --- Section 4: Overdue Analysis ---
    drawSectionHeader(4, 'OVERDUE ANALYSIS', COLORS.sectionRed);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(COLORS.textMedium);
    doc.text(`DETAILED OVERDUE LIST (${overdueLogs.length})`, MARGIN, cursorY);
    cursorY += 15;
    
    const overdueBody = overdueLogs.length > 0
        ? overdueLogs.map((log: OutingRecord) => [
            log.studentName,
            log.rollNumber,
            log.year,
            studentMap.get(log.studentId)?.hostel || '-',
            new Date(log.checkOutTime).toLocaleString('en-GB').replace(',', ''),
            log.outingType
          ])
        : [[{ content: 'No students are currently overdue.', colSpan: 6, styles: { halign: 'center', textColor: COLORS.textMedium } }]];
        
    (doc as any).autoTable({
        startY: cursorY,
        head: [['NAME', 'ROLL NO', 'YEAR', 'HOSTEL', 'OUT TIME', 'TYPE']],
        body: overdueBody,
        theme: 'grid',
        headStyles: {
            fillColor: COLORS.table.overdueHeaderBg, textColor: COLORS.textDark, fontStyle: 'bold', fontSize: 9, halign: 'center', lineColor: COLORS.borderLight, lineWidth: 0.5
        },
        columnStyles: { 
            0: { halign: 'left', cellWidth: 150 }, 
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'left' },
            4: { cellWidth: 100, halign: 'center' },
            5: { halign: 'center' }
        },
        styles: { cellPadding: 6, fontSize: 9, valign: 'middle', lineColor: COLORS.borderLight, font: 'Helvetica' },
        didDrawPage: (data: any) => { cursorY = data.cursor.y; }
    });
    
    // --- Add Footers to all pages ---
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        // Re-draw header on new pages created by autoTable
        if (i > 1) {
            drawPageHeader();
        }
        drawPageFooter(i, totalPages);
    }

    // --- Save Document ---
    doc.save(`OUTING_REPORT_${new Date().toISOString().slice(0,10)}.pdf`);
};
