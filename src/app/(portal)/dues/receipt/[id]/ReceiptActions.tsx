"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ReceiptActionsProps {
  paymentId: string;
  paymentReference: string | null;
  isConfirmed: boolean;
  isPending: boolean;
}

export function ReceiptActions({
  paymentId,
  paymentReference,
  isConfirmed,
  isPending,
}: ReceiptActionsProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (typeof window !== "undefined") {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");

        const element = document.getElementById("receipt-card");
        if (!element) {
          console.error("Receipt card element not found");
          return;
        }

        // Use html2canvas to capture the element
        const canvas = await html2canvas(element, {
          scale: 2, // higher resolution
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        
        // A4 size: 210mm x 297mm
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Add image to PDF with a top margin of 10mm
        pdf.addImage(imgData, "PNG", 0, 10, imgWidth, imgHeight);
        pdf.save("NFCS UNN Portal Receipt.pdf");
      } catch (error) {
        console.error("Error generating PDF:", error);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden select-none">
      {isConfirmed && (
        <>
          <Button
            onClick={handleDownloadPDF}
            variant="secondary"
            className="h-9 text-xs gap-2 font-semibold bg-brand-light text-brand hover:bg-brand/10 border border-brand/20"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            onClick={handlePrint}
            variant="secondary"
            className="h-9 text-xs gap-2 font-semibold border-neutrals-borderLight"
          >
            <Printer className="h-4 w-4" /> Print Receipt
          </Button>
        </>
      )}
      {isPending && paymentReference && (
        <Button asChild variant="primary" className="h-9 text-xs gap-2 font-semibold">
          <Link href={`/dues/pay/checkout?ref=${paymentReference}`}>
            <ExternalLink className="h-4 w-4" /> Complete Payment
          </Link>
        </Button>
      )}
    </div>
  );
}
