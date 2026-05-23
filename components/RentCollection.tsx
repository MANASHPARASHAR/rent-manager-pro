import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Building2,
  IndianRupee,
  X,
  Wallet,
  CalendarDays,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  RotateCcw,
  Activity,
  UserPlus,
  AlertCircle,
  Check,
  ArrowUpRight,
  Landmark,
  History,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Filter,
  MoreVertical,
  Undo2,
  Zap,
  Briefcase,
  Layers,
  Sparkles,
  Save,
  User,
  MapPin,
  ClipboardList,
  Settings,
  Plus,
  Trash2,
  StickyNote,
  Ban,
  MessageSquare,
  Mail,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { useRentalStore } from "../store/useRentalStore";
import { useLanguageStore } from "../lib/i18n";
import * as XLSX from "xlsx";
import {
  PaymentStatus,
  ColumnType,
  Payment,
  UnitHistory,
  ColumnDefinition,
  RecordValue,
  Property,
  UserRole,
} from "../types";

const RentCollection: React.FC = () => {
  const store = useRentalStore();
  const { t, language } = useLanguageStore();
  const SUPERADMIN_EMAIL = "manashparashar9926@gmail.com";
  const isAdmin =
    store.user?.role === UserRole.ADMIN ||
    store.user?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  const isManager = store.user?.role === UserRole.MANAGER;
  const canEdit = isAdmin || isManager;

  // --- SMART PAYMENTS DETECTOR AND BACKEND PARSER STATE ---
  const [detectorOpen, setDetectorOpen] = useState(false);
  const [detectorMode, setDetectorMode] = useState<"gmail" | "statement">("gmail");
  const [detectorQuery, setDetectorQuery] = useState("credited OR received OR payment OR rent");
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [detectedTransactions, setDetectedTransactions] = useState<any[]>([]);
  const [isSandboxMode, setIsSandboxMode] = useState(true); // Default to true so they can test immediately with zero setups
  const [approvedTxIds, setApprovedTxIds] = useState<Set<string>>(new Set());

  // Function to match a credit transaction with prospective pending tenancies
  const matchTransactionToTenant = (amount: number, description: string, refId: string) => {
    const descLower = (description || "").toLowerCase();
    
    // Find non-vacant, unpaid units for the selected month that have expected rent values
    const candidates = recordsWithRent.filter((r: any) => {
      return !r.isVacant && !r.isRentPaid && parseFloat(r.rentValue) > 0;
    });

    let bestMatch: any = null;
    let confidence: "HIGH" | "RENT_ONLY" | "PARTIAL" | "MULTI_MONTH" | "NONE" = "NONE";
    let matchReason = "";

    // 1. Try to find a candidate where Name or Property is mentioned in the description, AND check amount relation (exact, partial, multi-month)
    for (const c of candidates) {
      if (!c.tenantName) continue;
      const nameParts = c.tenantName.toLowerCase().split(/\s+/).filter((p: string) => p.length > 2);
      const isNameInDesc = nameParts.length > 0 && nameParts.some((part: string) => descLower.includes(part));
      const rentAmount = parseFloat(c.rentValue) || 0;

      if (isNameInDesc) {
        bestMatch = c;
        const isAmountMatch = Math.abs(rentAmount - amount) < 1;

        if (isAmountMatch) {
          confidence = "HIGH";
          matchReason = `Direct match found! Tenant name "${c.tenantName}" was detected in details, and the transaction of ₹${amount.toLocaleString()} matches exactly their expected monthly rent level.`;
        } else if (amount < rentAmount) {
          confidence = "PARTIAL";
          matchReason = `Partial Payment detected! Tenant name "${c.tenantName}" was found, and the payload ₹${amount.toLocaleString()} is a partial receipt of their ₹${rentAmount.toLocaleString()} expectations.`;
        } else {
          // amount > rentAmount
          const monthsCovered = Math.floor(amount / rentAmount);
          const remainder = amount % rentAmount;
          confidence = "MULTI_MONTH";
          if (remainder === 0) {
            matchReason = `Multi-Month Payment detected! Tenant "${c.tenantName}" paid ₹${amount.toLocaleString()}, covering exactly ${monthsCovered} consecutive months. Approving will automatically split and pre-pay these cycles.`;
          } else {
            matchReason = `Multi-Month & Partial Payment detected! Tenant "${c.tenantName}" paid ₹${amount.toLocaleString()}, covering ${monthsCovered} month(s) plus ₹${remainder.toLocaleString()} partial excess. Approving will auto-distribute this correctly.`;
          }
        }
        break;
      }
    }

    // 2. Look for exact amount matches if no strict tenant name was specified
    if (!bestMatch) {
      const amountMatches = candidates.filter((c: any) => {
        const rentAmount = parseFloat(c.rentValue) || 0;
        return Math.abs(rentAmount - amount) < 1;
      });

      if (amountMatches.length === 1) {
        bestMatch = amountMatches[0];
        confidence = "RENT_ONLY";
        matchReason = `Description mentions no tenant name, but this amount (₹${amount.toLocaleString()}) corresponds exactly to the unpaid expectation of ${amountMatches[0].tenantName}. No other active units expect this specific amount.`;
      } else if (amountMatches.length > 1) {
        bestMatch = amountMatches[0];
        confidence = "NONE";
        matchReason = `Multiple vacant/active tenants expect this exact rent figure (${amountMatches.map(m => m.tenantName).join(", ")}). Please select the correct tenant unit manually.`;
      } else {
        // Look for 2 months rent multiples without direct names
        const doubleMatches = candidates.filter((c: any) => {
          const rentAmount = parseFloat(c.rentValue) || 0;
          return Math.abs((rentAmount * 2) - amount) < 1;
        });

        if (doubleMatches.length === 1) {
          bestMatch = doubleMatches[0];
          confidence = "MULTI_MONTH";
          matchReason = `No direct tenant name matches, but ₹${amount.toLocaleString()} is exactly double (2 months) the monthly rent of ${doubleMatches[0].tenantName}. Approving will credit both current and next months.`;
        }
      }
    }

    return {
      matchedRecord: bestMatch,
      confidence,
      matchReason,
      allCandidates: candidates
    };
  };

  const handleScanGmail = async () => {
    setIsLoadingEmails(true);
    setGmailError(null);
    setDetectedTransactions([]);

    try {
      let token = store.googleAccessToken;
      if (!token) {
        setGmailError("Connect your Google/Gmail account first to utilize secure Live Scanner APIs.");
        setIsLoadingEmails(false);
        return;
      }

      const proxyRes = await fetch("/api/gmail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, q: detectorQuery, maxResults: 15 })
      });

      if (!proxyRes.ok) {
        if (proxyRes.status === 401) {
          store.setGoogleAccessToken(null);
          throw new Error("Expired session hook. Please click Link Gmail again to authorize access token.");
        }
        const errJson = await proxyRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Gmail proxy server responded with status ${proxyRes.status}.`);
      }

      const { messages } = await proxyRes.json();
      if (!messages || messages.length === 0) {
        setGmailError("No credit notification emails detected in the last search.");
        setIsLoadingEmails(false);
        return;
      }

      const parsedTxList: any[] = [];

      for (const email of messages) {
        try {
          const msgId = email.id;
          const snippet = email.snippet || "";
          const subjectHeader = email.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
          const dateHeader = email.payload?.headers?.find((h: any) => h.name === "Date")?.value || "";
          
          const fullText = `${subjectHeader} - ${snippet}`;
          
          // Regex search for currency indicators
          const rupeeRegex = /(?:rs\.?|inr|₹|usd)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)/i;
          const matchRupee = fullText.match(rupeeRegex);
          let amount: number | null = null;
          if (matchRupee) {
            amount = parseFloat(matchRupee[1].replace(/,/g, ""));
          } else {
            const creditRegex = /(?:credited|received|deposited|transfer of)\s+(?:of\s+)?(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)/i;
            const matchCredit = fullText.match(creditRegex);
            if (matchCredit) {
              amount = parseFloat(matchCredit[1].replace(/,/g, ""));
            }
          }

          if (!amount || isNaN(amount) || amount <= 0) continue;

          const utrRegex = /(?:utr|ref|transaction\s+no|upi\s+ref)\s*:?\s*([a-z0-9]+)/i;
          const matchUtr = fullText.match(utrRegex);
          const utr = matchUtr ? matchUtr[1] : `TXN${msgId.substring(0, 8).toUpperCase()}`;

          const { matchedRecord, confidence, matchReason, allCandidates } = matchTransactionToTenant(amount, fullText, utr);

          parsedTxList.push({
            id: msgId,
            source: "GMAIL",
            subject: subjectHeader,
            date: dateHeader ? new Date(dateHeader).toLocaleDateString() : new Date().toLocaleDateString(),
            snippet: snippet,
            amount,
            utr,
            matchedRecord,
            confidence,
            matchReason,
            allCandidates,
            textBody: fullText
          });
        } catch (err) {
          console.error("Error reading single Gmail message payload:", err);
        }
      }

      setDetectedTransactions(parsedTxList);
      if (parsedTxList.length === 0) {
        setGmailError("Identified emails matching query, but failed to scan clear deposit amount and transaction references. Adjust queries.");
      }
    } catch (err: any) {
      console.error(err);
      setGmailError(err.message || "An issue occurred connecting to the Live Gmail Scanner API.");
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleLoadSandboxData = () => {
    setIsLoadingEmails(true);
    setGmailError(null);
    setDetectedTransactions([]);

    setTimeout(() => {
      const unpaidRecords = recordsWithRent.filter((r: any) => !r.isVacant && !r.isRentPaid && parseFloat(r.rentValue) > 0);
      
      if (unpaidRecords.length === 0) {
        setGmailError("All tenants have already registered full payments for this month. Try selecting another billing month!");
        setIsLoadingEmails(false);
        return;
      }

      const mockTrxs: any[] = [];

      unpaidRecords.forEach((rec: any, idx: number) => {
        const baseRent = parseFloat(rec.rentValue) || 10000;
        const utr = `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;

        let amount = baseRent;
        let snippet = "";
        let subject = "";

        if (idx === 0) {
          // Generate a Partial Payment Simulation
          amount = baseRent * 0.5; // 50% partial payment
          subject = `Alert: HDFC A/c Credited (Partial) - ₹${amount.toLocaleString()}`;
          snippet = `HDFC Bank SMS Alert: Your Account has been credited with ₹${amount.toLocaleString()} on 2026-05-21 from UPI payment of ${rec.tenantName}. Ref ID: ${utr}. Reason: Rent partial payment.`;
        } else if (idx === 1) {
          // Generate a 2-Month Multi-Payment Simulation (Double)
          amount = baseRent * 2; // Exactly 2 months rent
          subject = `Alert: SBI A/c Credited - ₹${amount.toLocaleString()}`;
          snippet = `SBI A/c Credited: Rent receipt of ₹${amount.toLocaleString()} received via IMPS from ${rec.tenantName} for 2 months advance. UTR Number: ${utr}.`;
        } else {
          // Normal payment
          subject = `Transaction Advice: ₹${amount.toLocaleString()}`;
          snippet = `Rent payment of ₹${amount.toLocaleString()} successfully received from tenant ${rec.tenantName}. Credited to ledger with Ref: ${utr}.`;
        }

        const textBody = `${subject} - ${snippet}`;
        const { matchedRecord, confidence, matchReason, allCandidates } = matchTransactionToTenant(amount, textBody, utr);

        mockTrxs.push({
          id: `mock-txn-${rec.id}-${idx}`,
          source: "SIMULATED_GMAIL",
          subject,
          date: new Date().toLocaleDateString(),
          snippet,
          amount,
          utr,
          matchedRecord,
          confidence,
          matchReason,
          allCandidates,
          textBody
        });
      });

      // Add one unmatched txn (e.g. random partial amount with unknown source)
      const unmatchedAmount = 4500;
      const unmatchedUtr = `UTR999901025555`;
      const unmatchedText = `ICICI Bank Credit Alert: Account credited with Rs ${unmatchedAmount}.00 - Transfer via IMPS/UPI from unknown source. Ref Num ${unmatchedUtr}.`;
      const { matchedRecord, confidence, matchReason, allCandidates } = matchTransactionToTenant(unmatchedAmount, unmatchedText, unmatchedUtr);

      mockTrxs.push({
        id: `mock-unmatched-${Date.now()}`,
        source: "SIMULATED_GMAIL",
        subject: `Unknown Credit Transaction: INR ${unmatchedAmount}`,
        date: new Date().toLocaleDateString(),
        snippet: `Received credit transaction of ₹${unmatchedAmount}. Description mentions no tenant names or property tags. Ref No ${unmatchedUtr}.`,
        amount: unmatchedAmount,
        utr: unmatchedUtr,
        matchedRecord,
        confidence,
        matchReason,
        allCandidates,
        textBody: unmatchedText
      });

      setDetectedTransactions(mockTrxs);
      setIsLoadingEmails(false);
    }, 700);
  };

  const handleStatementUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGmailError(null);
    setDetectedTransactions([]);
    setIsLoadingEmails(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rawRows.length === 0) {
          throw new Error("Sheet is completely empty.");
        }

        let dateColIdx = -1;
        let descColIdx = -1;
        let creditColIdx = -1;
        let utrColIdx = -1;

        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(15, rawRows.length); r++) {
          const cols = rawRows[r];
          if (!cols || !Array.isArray(cols)) continue;
          
          const isHeader = cols.some((c: any) => {
            const s = String(c).toLowerCase();
            return s.includes("date") || s.includes("narration") || s.includes("particulars") || s.includes("credit") || s.includes("deposit") || s.includes("amount");
          });

          if (isHeader) {
            headerRowIdx = r;
            cols.forEach((cellVal: any, idx: number) => {
              const s = String(cellVal).toLowerCase();
              if (s.includes("date")) dateColIdx = idx;
              if (s.includes("description") || s.includes("narration") || s.includes("particulars") || s.includes("remarks")) descColIdx = idx;
              if (s.includes("credit") || s.includes("deposit") || s.includes("amount")) creditColIdx = idx;
              if (s.includes("ref") || s.includes("utr") || s.includes("reference") || s.includes("cheque")) utrColIdx = idx;
            });
            break;
          }
        }

        if (dateColIdx === -1) dateColIdx = 0;
        if (descColIdx === -1) descColIdx = Math.min(1, rawRows[headerRowIdx].length - 1);
        if (creditColIdx === -1) creditColIdx = Math.min(2, rawRows[headerRowIdx].length - 1);

        const parsedList: any[] = [];

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length <= Math.min(dateColIdx, creditColIdx)) continue;

          const dateVal = row[dateColIdx];
          const descVal = row[descColIdx];
          const creditValStr = row[creditColIdx];
          
          if (!dateVal || !descVal) continue;

          let amount = 0;
          if (typeof creditValStr === "number") {
            amount = creditValStr;
          } else {
            amount = parseFloat(String(creditValStr || "0").replace(/[^0-9.]/g, ""));
          }

          if (isNaN(amount) || amount <= 0) continue;

          let utr = "";
          if (utrColIdx !== -1 && row[utrColIdx]) {
            utr = String(row[utrColIdx]);
          } else {
            const matchUtr = String(descVal).match(/(?:utr|ref|upi\s+num|txn)\s*:?\s*([a-z0-9]+)/i);
            utr = matchUtr ? matchUtr[1] : `TX-${r}-${Date.now().toString().slice(-4)}`;
          }

          const descText = String(descVal);
          const { matchedRecord, confidence, matchReason, allCandidates } = matchTransactionToTenant(amount, descText, utr);

          parsedList.push({
            id: `statement-row-${r}-${Date.now()}`,
            source: "STATEMENT_UPLOAD",
            subject: "Statement Transaction",
            date: String(dateVal),
            snippet: descText,
            amount,
            utr,
            matchedRecord,
            confidence,
            matchReason,
            allCandidates,
            textBody: descText
          });
        }

        setDetectedTransactions(parsedList);
        if (parsedList.length === 0) {
          throw new Error("Parsed sheet but found no positive deposit/credit transactions. Make sure the headers are descriptive.");
        }
      } catch (err: any) {
        console.error(err);
        setGmailError(err.message || "Failed to parse bank statement file. Check header names.");
      } finally {
        setIsLoadingEmails(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleApproveTransaction = async (tx: any, manualRecordId?: string) => {
    const finalRecordId = manualRecordId || tx.matchedRecord?.id;
    if (!finalRecordId) {
      alert("No matched tenant unit selected. Please select a tenant to reconcile this payment.");
      return;
    }

    const matchedUnit = store.records.find((r: any) => r.id === finalRecordId);
    if (!matchedUnit) return;

    const matchedWithRent = recordsWithRent.find((r: any) => r.id === finalRecordId);
    const rentAmount = matchedWithRent ? parseFloat(matchedWithRent.rentValue) || 0 : 0;
    const totalRentPaid = matchedWithRent ? Number(matchedWithRent.totalRentPaid) || 0 : 0;

    const paymentsToAdd: { month: string; amount: number; remarks: string }[] = [];

    if (rentAmount > 0) {
      const remainingSelectedMonthRent = Math.max(0, rentAmount - totalRentPaid);

      if (tx.amount <= remainingSelectedMonthRent || remainingSelectedMonthRent <= 0) {
        // Simple case: transaction fits in current month or is a simple partial, or current month is already paid/vacant expectation
        paymentsToAdd.push({
          month: selectedMonth,
          amount: tx.amount,
          remarks: `Auto-Reconciled ${tx.source === "STATEMENT_UPLOAD" ? "Bank Statement" : "Gmail"}: ${tx.amount < rentAmount ? "Partial Rent Payment" : "Rent Payment"}. UTR: ${tx.utr}.`
        });
      } else {
        // Multi-month distribution or overpayment scenario!
        if (remainingSelectedMonthRent > 0) {
          paymentsToAdd.push({
            month: selectedMonth,
            amount: remainingSelectedMonthRent,
            remarks: `Auto-Reconciled ${tx.source === "STATEMENT_UPLOAD" ? "Bank Statement" : "Gmail"} (Part 1 - Dues Completed): Rent Payment. UTR: ${tx.utr}.`
          });
        }

        let surplus = tx.amount - remainingSelectedMonthRent;
        let currentMonthKey = selectedMonth;

        const getNextMonth = (monthStr: string) => {
          const [y, m] = monthStr.split("-").map(Number);
          const nextDate = new Date(y, m, 1);
          return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
        };

        // Distribute the remaining balance sequentially
        while (surplus > 0) {
          currentMonthKey = getNextMonth(currentMonthKey);
          const nextMonthAlloc = Math.min(surplus, rentAmount);
          if (nextMonthAlloc <= 0) break;

          paymentsToAdd.push({
            month: currentMonthKey,
            amount: nextMonthAlloc,
            remarks: `Auto-Reconciled Surplus ${tx.source === "STATEMENT_UPLOAD" ? "Bank Statement" : "Gmail"}: Advance Allocation for ${currentMonthKey}. UTR: ${tx.utr}.`
          });

          surplus = parseFloat((surplus - nextMonthAlloc).toFixed(2));
        }
      }
    } else {
      // Direct fallback: make a single payment entry
      paymentsToAdd.push({
        month: selectedMonth,
        amount: tx.amount,
        remarks: `Auto-Reconciled ${tx.source === "STATEMENT_UPLOAD" ? "Bank Statement" : "Gmail"}: Rent Allocation. UTR: ${tx.utr}.`
      });
    }

    try {
      // Sequentially save payment objects in Firestore
      for (const segment of paymentsToAdd) {
        const paymentData = {
          recordId: finalRecordId,
          propertyId: matchedUnit.propertyId,
          month: segment.month,
          type: "RENT",
          amount: segment.amount,
          paidAt: new Date().toISOString(),
          paymentMode: "UPI/QR",
          paidTo: store.config.paidToOptions?.[0] || "Bank Account",
          remarks: segment.remarks,
        };
        await store.addPayment(paymentData);
      }
      
      // Mark as approved locally to hide from scanner
      setApprovedTxIds((prev) => {
        const next = new Set(prev);
        next.add(tx.id);
        return next;
      });
    } catch (err) {
      console.error("Reconciliation failed:", err);
      alert("Reconciliation failed. Try again.");
    }
  };

  const effectiveUser = store.effectiveUser;
  const effectiveIsAdmin =
    effectiveUser?.role === UserRole.ADMIN ||
    effectiveUser?.username?.toLowerCase().trim() === SUPERADMIN_EMAIL;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [rentFilter, setRentFilter] = useState<string>("all");
  const [occupancyFilter, setOccupancyFilter] = useState<string>("all");

  const [paymentModal, setPaymentModal] = useState<any>({
    isOpen: false,
    record: null,
    type: "RENT",
    amount: "",
    paidTo: store.config.paidToOptions?.[0] || "",
    mode: store.config.paymentModeOptions?.[0] || "",
    date: new Date().toLocaleDateString("en-CA"),
    time: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    startReading: "",
    endReading: "",
    perUnitCost: "",
  });

  const [revertModal, setRevertModal] = useState<any>({
    isOpen: false,
    record: null,
    type: "RENT",
    monthKey: "",
  });

  const [refundConfirm, setRefundConfirm] = useState<{
    isOpen: boolean;
    record: any | null;
  }>({
    isOpen: false,
    record: null,
  });

  const [configModal, setConfigModal] = useState({
    isOpen: false,
    newPaidTo: "",
    newMode: "",
    editingPaidTo: null as { original: string; current: string } | null,
    editingMode: null as { original: string; current: string } | null,
  });

  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    record: any | null;
  }>({
    isOpen: false,
    record: null,
  });

  const [temporalAction, setTemporalAction] = useState<any>({
    isOpen: false,
    type: "STATUS",
    record: null,
    formValues: {},
    effectiveDate: new Date().toLocaleDateString("en-CA"),
    effectiveTime: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    errors: {},
  });

  const [notesModal, setNotesModal] = useState<{
    isOpen: boolean;
    record: any | null;
    text: string;
  }>({
    isOpen: false,
    record: null,
    text: "",
  });

  const [unitDetailsModal, setUnitDetailsModal] = useState<{
    isOpen: boolean;
    record: any | null;
  }>({
    isOpen: false,
    record: null,
  });

  const [reminderModal, setReminderModal] = useState<{
    isOpen: boolean;
    record: any | null;
    phone: string;
    message: string;
  }>({
    isOpen: false,
    record: null,
    phone: "",
    message: "",
  });

  const handleOpenReminder = (record: any, phone: string) => {
    const pName = record.property?.name || "Property";
    const tName = record.tenantName || "Tenant";
    const rentVal = record.rentAmount
      ? record.rentAmount.toLocaleString("en-IN")
      : "0";
    const monthFormatted = selectedMonth;

    const isHi = language === "hi";
    const defaultMsg = isHi
      ? `नमस्ते ${tName}, आपके ${pName} का ${monthFormatted} महीने का किराया ₹${rentVal} अभी तक लंबित है। कृपया जल्द से जल्द भुगतान सुनिश्चित करें। धन्यवाद!`
      : `Dear ${tName}, your rent of ₹${rentVal} for ${pName} (Month: ${monthFormatted}) is currently pending. Please pay at your earliest convenience. Thank you!`;

    setReminderModal({
      isOpen: true,
      record,
      phone,
      message: defaultMsg,
    });
  };

  const [metaSending, setMetaSending] = useState(false);
  const [whatsappConnectionState, setWhatsappConnectionState] = useState<{
    status: "idle" | "testing" | "success" | "error";
    verifiedName?: string;
    phoneNumber?: string;
    errorMessage?: string;
  }>({
    status: "idle",
  });

  const handleTestWhatsappConnection = async () => {
    const token = store.config?.whatsappAccessToken;
    const phoneId = store.config?.whatsappPhoneID;

    if (!token || !phoneId) {
      setWhatsappConnectionState({
        status: "error",
        errorMessage: "कृपया Meta System Access Token और WhatsApp Phone Number ID दोनों दर्ज करें।",
      });
      return;
    }

    setWhatsappConnectionState({ status: "testing" });

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        let errorMsg = "API returned an error.";
        if (data?.error?.message) {
          errorMsg = `${data.error.message} (Code: ${data.error.code || "unknown"})`;
        } else if (data?.error?.error_user_msg) {
          errorMsg = data.error.error_user_msg;
        }
        setWhatsappConnectionState({
          status: "error",
          errorMessage: errorMsg,
        });
        return;
      }

      setWhatsappConnectionState({
        status: "success",
        verifiedName: data.verified_name || "Meta Business API",
        phoneNumber: data.display_phone_number || "Successfully Verified",
      });
    } catch (err: any) {
      setWhatsappConnectionState({
        status: "error",
        errorMessage: err?.message || "Meta Graph server से संपर्क करने में असमर्थ।",
      });
    }
  };

  const [bulkReminderState, setBulkReminderState] = useState<{
    isOpen: boolean;
    sending: boolean;
    isReviewPhase: boolean;
    currentIndex: number;
    total: number;
    logs: string[];
  }>({
    isOpen: false,
    sending: false,
    isReviewPhase: false,
    currentIndex: 0,
    total: 0,
    logs: [],
  });

  const handleSendIndividualMetaReminder = async () => {
    const record = reminderModal.record;
    if (!record) return;

    const token = store.config?.whatsappAccessToken;
    const phoneId = store.config?.whatsappPhoneID;
    const templateName = store.config?.whatsappTemplateName || "rent_reminder";
    const languageCode = language === "hi" ? "hi" : "en";

    if (!token || !phoneId) {
      alert(
        "Please configure WhatsApp Access Token and Phone Number ID in Settings.",
      );
      return;
    }

    setMetaSending(true);
    try {
      const cleanDigits = reminderModal.phone.replace(/\D/g, "");
      const finalPhone =
        cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

      const pName = record.property?.name || "Property";
      const tName = record.tenantName || "Tenant";
      const rentVal = record.rentAmount ? record.rentAmount.toString() : "0";

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: finalPhone,
            type: "template",
            template: {
              name: templateName,
              language: { code: languageCode },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: tName },
                    { type: "text", text: rentVal },
                    { type: "text", text: pName },
                    { type: "text", text: selectedMonth },
                  ],
                },
              ],
            },
          }),
        },
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData?.error?.message || "Meta API returned error status",
        );
      }

      await store.updateRecordReminder(record.id, selectedMonth);
      alert("✅ WhatsApp Message sent successfully via Meta Cloud API!");
      setReminderModal((prev) => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      alert(`❌ Meta API Error: ${error.message}`);
    } finally {
      setMetaSending(false);
    }
  };

  const [recordsPerPage, setRecordsPerPage] = useState<number | "all">(25);
  const [currentPage, setCurrentPage] = useState(1);

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + direction);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const jumpToToday = () => {
    const d = new Date();
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const handleAddPaidTo = () => {
    if (!configModal.newPaidTo.trim()) return;
    store.updateConfig({
      paidToOptions: [
        ...(store.config.paidToOptions || []),
        configModal.newPaidTo.trim(),
      ],
    });
    setConfigModal({ ...configModal, newPaidTo: "" });
  };

  const handleRemovePaidTo = (val: string) => {
    store.updateConfig({
      paidToOptions: (store.config.paidToOptions || []).filter(
        (o: string) => o !== val,
      ),
    });
  };

  const handleMovePaidTo = (index: number, direction: "up" | "down") => {
    const newOptions = [...(store.config.paidToOptions || [])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOptions.length) return;
    [newOptions[index], newOptions[targetIndex]] = [
      newOptions[targetIndex],
      newOptions[index],
    ];
    store.updateConfig({ paidToOptions: newOptions });
  };

  const handleSavePaidToEdit = () => {
    if (!configModal.editingPaidTo || !configModal.editingPaidTo.current.trim())
      return;
    const newOptions = (store.config.paidToOptions || []).map((o: string) =>
      o === configModal.editingPaidTo?.original
        ? configModal.editingPaidTo.current.trim()
        : o,
    );
    store.updateConfig({ paidToOptions: newOptions });
    setConfigModal({ ...configModal, editingPaidTo: null });
  };

  const handleAddMode = () => {
    if (!configModal.newMode.trim()) return;
    store.updateConfig({
      paymentModeOptions: [
        ...(store.config.paymentModeOptions || []),
        configModal.newMode.trim(),
      ],
    });
    setConfigModal({ ...configModal, newMode: "" });
  };

  const handleRemoveMode = (val: string) => {
    store.updateConfig({
      paymentModeOptions: (store.config.paymentModeOptions || []).filter(
        (o: string) => o !== val,
      ),
    });
  };

  const handleMoveMode = (index: number, direction: "up" | "down") => {
    const newOptions = [...(store.config.paymentModeOptions || [])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOptions.length) return;
    [newOptions[index], newOptions[targetIndex]] = [
      newOptions[targetIndex],
      newOptions[index],
    ];
    store.updateConfig({ paymentModeOptions: newOptions });
  };

  const handleSaveModeEdit = () => {
    if (!configModal.editingMode || !configModal.editingMode.current.trim())
      return;
    const newOptions = (store.config.paymentModeOptions || []).map(
      (o: string) =>
        o === configModal.editingMode?.original
          ? configModal.editingMode.current.trim()
          : o,
    );
    store.updateConfig({ paymentModeOptions: newOptions });
    setConfigModal({ ...configModal, editingMode: null });
  };

  const visibleProperties = useMemo(() => {
    return (store.properties || []).filter((p: Property) => {
      const lowerUsername = effectiveUser?.username?.toLowerCase().trim() || "";
      const userId = effectiveUser?.id || "";
      const allowed = (p.allowedUserIds || []).map((id) => id.toLowerCase());
      return (
        effectiveIsAdmin ||
        (effectiveUser?.assignedPropertyIds || []).includes(p.id) ||
        allowed.includes(userId.toLowerCase()) ||
        allowed.includes(lowerUsername)
      );
    });
  }, [store.properties, effectiveUser, effectiveIsAdmin]);

  const visiblePropertyIds = useMemo(
    () => visibleProperties.map((p: any) => p.id),
    [visibleProperties],
  );

  const uniqueCities = useMemo(() => {
    const cities = visibleProperties
      .map((p) => p.city)
      .filter(Boolean) as string[];
    return Array.from(new Set(cities)).sort();
  }, [visibleProperties]);

  const dynamicLedgerHeaders = useMemo(() => {
    const typesToConsider =
      selectedPropertyId === "all"
        ? store.propertyTypes.filter((t: any) =>
            visibleProperties.some((p: any) => p.propertyTypeId === t.id),
          )
        : store.propertyTypes.filter(
            (t: any) =>
              store.properties.find((p: any) => p.id === selectedPropertyId)
                ?.propertyTypeId === t.id,
          );

    const columns: { name: string; id: string }[] = [];
    const seenNames = new Set<string>();

    typesToConsider.forEach((type: any) => {
      type.columns.forEach((col: ColumnDefinition) => {
        if (col.isDefaultInLedger && !seenNames.has(col.name.toLowerCase())) {
          const lowerName = col.name.toLowerCase();
          const excluded = [
            "tenant name",
            "unit",
            "occupancy",
            "electricity bill",
            "elec. reading",
          ];
          if (!excluded.some((ex) => lowerName.includes(ex))) {
            columns.push({ name: col.name, id: col.id });
            seenNames.add(lowerName);
          }
        }
      });
    });

    return columns;
  }, [
    store.propertyTypes,
    store.properties,
    selectedPropertyId,
    visibleProperties,
  ]);

  const recordsWithRent = useMemo(() => {
    // Deduplicate payments by ID to prevent inflated collection stats
    const pUnique = new Map();
    (store.payments || []).forEach((p: any) => {
      if (!pUnique.has(p.id)) pUnique.set(p.id, p);
    });
    const deduplicatedPayments = Array.from(pUnique.values());

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m] = selectedMonth.split("-").map(Number);
    const startOfMonth = new Date(y, m - 1, 1, 0, 0, 0);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);

    return store.records
      .filter((r: any) => visiblePropertyIds.includes(r.propertyId))
      .map((record: any) => {
        const property = store.properties.find(
          (p: any) => p.id === record.propertyId,
        );
        const propertyType = store.propertyTypes.find(
          (t: any) => t.id === property?.propertyTypeId,
        );
        const pName = property?.name || "Unassigned Asset";

        const dueDay = propertyType?.defaultDueDateDay || 5;

        const occupancyCol = propertyType?.columns.find(
          (c) => c.type === ColumnType.OCCUPANCY_STATUS,
        );
        const rentCol = propertyType?.columns.find((c) => c.isRentCalculatable);
        const depositCol = propertyType?.columns.find(
          (c) => c.type === ColumnType.SECURITY_DEPOSIT,
        );
        const nameCol = propertyType?.columns.find((c) =>
          c.name.toLowerCase().includes("name"),
        );

        // Get history for this record, sorted by most recent start first
        const histsForRecord = store.unitHistory
          .filter((h: any) => h.recordId === record.id)
          .sort(
            (a: any, b: any) =>
              new Date(b.effectiveFrom).getTime() -
              new Date(a.effectiveFrom).getTime(),
          );

        // Find hists that overlapped with this month
        const overlappingHists = histsForRecord.filter((h: any) => {
          const from = new Date(h.effectiveFrom);
          const to = h.effectiveTo
            ? new Date(h.effectiveTo)
            : new Date(8640000000000000);
          return from <= endOfMonth && to >= startOfMonth;
        });

        // Representative History for the month:
        // 1. If any history in this month is "Active" (not Vacant), pick the most recent one of those.
        // 2. Otherwise, pick the most recent history of the month (likely the last Vacant one).
        let historicalState =
          overlappingHists.find((h: any) => {
            const occVal = String(
              h.values[occupancyCol?.id || ""] || "",
            ).toLowerCase();
            return occVal && !occVal.includes("vacant");
          }) || overlappingHists[0];

        // Fallback for dates before the first history entry
        if (!historicalState && histsForRecord.length > 0) {
          const oldestHist = histsForRecord[histsForRecord.length - 1];
          if (endOfMonth < new Date(oldestHist.effectiveFrom)) {
            historicalState = {
              values: {
                ...(occupancyCol ? { [occupancyCol.id]: "Vacant" } : {}),
                ...(nameCol ? { [nameCol.id]: "-" } : {}),
              },
            } as any;
          }
        }

        const activeValues =
          historicalState?.values ||
          store.recordValues
            .filter((v: any) => v.recordId === record.id)
            .reduce(
              (acc: any, v: any) => ({ ...acc, [v.columnId]: v.value }),
              {},
            );

        const rentValue = activeValues[rentCol?.id || ""] || "0";
        const depositValue = activeValues[depositCol?.id || ""] || "0";
        const occupancyValue = activeValues[occupancyCol?.id || ""] || "Active";
        const tenantName = activeValues[nameCol?.id || ""] || "Unknown";
        const isVacant = (occupancyValue || "")
          .toLowerCase()
          .includes("vacant");
        const currentHistoryId = historicalState?.id;

        const monthlyPayments = deduplicatedPayments.filter(
          (p: any) =>
            p.recordId === record.id &&
            p.month === selectedMonth &&
            p.type === "RENT" &&
            (!p.historyId || p.historyId === currentHistoryId),
        );
        const totalRentPaid = monthlyPayments.reduce(
          (acc: number, p: any) => acc + (Number(p.amount) || 0),
          0,
        );
        const parsedRentValue = isVacant ? 0 : (parseFloat(rentValue) || 0);
        const parsedDepositValue = isVacant ? 0 : (parseFloat(depositValue) || 0);

        const isRentPaid =
          totalRentPaid >= parsedRentValue && parsedRentValue > 0;
        const isPartialPaid =
          totalRentPaid > 0 && totalRentPaid < parsedRentValue;

        const electricityPayments = deduplicatedPayments.filter(
          (p: any) =>
            String(p.recordId) === String(record.id) &&
            p.month === selectedMonth &&
            p.type === "ELECTRICITY" &&
            (!p.historyId || p.historyId === currentHistoryId),
        );
        const totalElectricityPaid = electricityPayments.reduce(
          (acc: number, p: any) => acc + (Number(p.amount) || 0),
          0,
        );
        const isElectricityPaid = totalElectricityPaid > 0;

        const depositPayments = deduplicatedPayments.filter(
          (p: any) =>
            String(p.recordId) === String(record.id) &&
            p.type === "DEPOSIT" &&
            (!p.historyId || p.historyId === currentHistoryId),
        );
        const isDepositRefunded = depositPayments.some(
          (p: any) => p.isRefunded,
        );
        const totalDepositPaid = depositPayments.reduce(
          (acc: number, p: any) => acc + (Number(p.amount) || 0),
          0,
        );
        const isDepositPaid =
          totalDepositPaid >= parsedDepositValue &&
          parsedDepositValue > 0;
        const isDepositPartialPaid =
          totalDepositPaid > 0 && totalDepositPaid < parsedDepositValue;

        let statusBadge: any = "PENDING";
        if (isRentPaid) statusBadge = "PAID";
        else if (isPartialPaid) statusBadge = "PARTIAL";
        else if (isVacant && totalRentPaid === 0) statusBadge = "VACANT";
        else {
          const deadline = new Date(y, m - 1, dueDay, 23, 59, 59);
          if (today > deadline) statusBadge = "OVERDUE";
        }

        return {
          ...record,
          property: property
            ? { ...property, name: pName }
            : { id: "unknown", name: "Unassigned Asset" },
          propertyType,
          tenantName: tenantName || "Unknown Tenant",
          city: property?.city,
          historyId: currentHistoryId,
          rentAmount: parsedRentValue,
          depositAmount: parsedDepositValue,
          isRentPaid,
          isPartialPaid,
          totalRentPaid,
          isElectricityPaid,
          totalElectricityPaid,
          isDepositPaid,
          isDepositPartialPaid,
          totalDepositPaid,
          isDepositRefunded,
          isVacant,
          statusBadge,
          rawValuesMap: activeValues,
        };
      })
      .filter((r: any) => {
        const matchesProp =
          selectedPropertyId === "all" || r.propertyId === selectedPropertyId;
        const matchesCity = selectedCity === "all" || r.city === selectedCity;
        const matchesSearch =
          searchTerm === "" ||
          Object.values(r.rawValuesMap).some((v) =>
            String(v).toLowerCase().includes(searchTerm.toLowerCase()),
          );
        return matchesProp && matchesCity && matchesSearch;
      });
  }, [
    store.records,
    store.properties,
    store.propertyTypes,
    store.recordValues,
    store.unitHistory,
    store.payments,
    selectedMonth,
    searchTerm,
    selectedPropertyId,
    selectedCity,
    visiblePropertyIds,
  ]);

  const whatsappRemindersDueDetail = useMemo(() => {
    const isMetaConfigured = !!(
      store.config?.whatsappAccessToken && store.config?.whatsappPhoneID
    );
    if (!isMetaConfigured) return { count: 0, list: [] };

    const intervalDays = store.config?.whatsappReminderIntervalDays || 3;
    const now = new Date().getTime();

    const dueList = recordsWithRent.filter((record: any) => {
      // Must be unpaid
      if (record.isRentPaid || record.isVacant) return false;

      // Check phone number
      const phoneCol = record.propertyType?.columns.find(
        (col: any) =>
          col.type === ColumnType.PHONE ||
          col.name.toLowerCase().includes("phone") ||
          (col.name.toLowerCase().includes("number") &&
            !col.isRentCalculatable),
      );
      const tenantPhone = record.rawValuesMap?.[phoneCol?.id || ""] || "";
      if (!tenantPhone) return false;

      // Get last reminder timestamp
      const fieldName = `lastReminderSent_${selectedMonth.replace(/-/g, "_")}`;
      const lastSentIso = record[fieldName];
      if (!lastSentIso) return true; // Never sent, so it is due for a reminder!

      // Check if interval days have passed
      const lastSentTime = new Date(lastSentIso).getTime();
      const diffMs = now - lastSentTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= intervalDays;
    });

    return {
      count: dueList.length,
      list: dueList,
    };
  }, [recordsWithRent, store.config, selectedMonth]);

  const handleTriggerBulkReminders = async (isAuto = false) => {
    const list = whatsappRemindersDueDetail.list;
    if (list.length === 0) return;

    const token = store.config?.whatsappAccessToken;
    const phoneId = store.config?.whatsappPhoneID;

    if (!token || !phoneId) {
      if (!isAuto) {
        alert(
          "Please configure WhatsApp Access Token and Phone Number ID in Settings.",
        );
      }
      return;
    }

    setBulkReminderState({
      isOpen: true,
      sending: false,
      isReviewPhase: true,
      currentIndex: 0,
      total: list.length,
      logs: [],
    });
  };

  const startSendingBulkReminders = async () => {
    const list = whatsappRemindersDueDetail.list;
    if (list.length === 0) return;

    const token = store.config?.whatsappAccessToken;
    const phoneId = store.config?.whatsappPhoneID;
    const templateName = store.config?.whatsappTemplateName || "rent_reminder";
    const languageCode = language === "hi" ? "hi" : "en";

    if (!token || !phoneId) {
      alert(
        "Please configure WhatsApp Access Token and Phone Number ID in Settings.",
      );
      return;
    }

    setBulkReminderState({
      isOpen: true,
      sending: true,
      isReviewPhase: false,
      currentIndex: 0,
      total: list.length,
      logs: ["🚀 Initializing WhatsApp Cloud API connection..."],
    });

    for (let i = 0; i < list.length; i++) {
      const record = list[i];
      const pName = record.property?.name || "Property";
      const tName = record.tenantName || "Tenant";
      const rentVal = record.rentAmount ? record.rentAmount.toString() : "0";

      const phoneCol = record.propertyType?.columns.find(
        (col: any) =>
          col.type === ColumnType.PHONE ||
          col.name.toLowerCase().includes("phone") ||
          (col.name.toLowerCase().includes("number") &&
            !col.isRentCalculatable),
      );
      const rawPhone = record.rawValuesMap?.[phoneCol?.id || ""] || "";
      const cleanDigits = rawPhone.replace(/\D/g, "");
      const finalPhone =
        cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

      setBulkReminderState((prev) => ({
        ...prev,
        currentIndex: i + 1,
        logs: [...prev.logs, `Sending to ${tName} (${finalPhone})...`],
      }));

      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${phoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: finalPhone,
              type: "template",
              template: {
                name: templateName,
                language: { code: languageCode },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: tName },
                      { type: "text", text: rentVal },
                      { type: "text", text: pName },
                      { type: "text", text: selectedMonth },
                    ],
                  },
                ],
              },
            }),
          },
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData?.error?.message || "Meta API returned error status",
          );
        }

        // Output success and save reminder sent date
        await store.updateRecordReminder(record.id, selectedMonth);

        setBulkReminderState((prev) => ({
          ...prev,
          logs: [...prev.logs, `✅ Successfully sent to ${tName}!`],
        }));
      } catch (err: any) {
        setBulkReminderState((prev) => ({
          ...prev,
          logs: [...prev.logs, `❌ Failed for ${tName}: ${err.message}`],
        }));
      }

      // 600ms throttle to prevent rate-limiting or network congestion
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    setBulkReminderState((prev) => ({
      ...prev,
      sending: false,
      logs: [...prev.logs, "🎉 Bulk processing completed!"],
    }));
  };

  const ledgerStats = useMemo(() => {
    let collected = 0;
    let electricityCollected = 0;
    let pending = 0;
    let heldDeposits = 0;

    recordsWithRent.forEach((r) => {
      // Always include collected amounts regardless of vacancy status
      collected += r.totalRentPaid;
      electricityCollected += r.totalElectricityPaid;
      heldDeposits += r.totalDepositPaid;

      // Only calculate pending amount for non-vacant units OR units with outstanding balance (arrears)
      if (!r.isVacant || (r.rentAmount > 0 && !r.isRentPaid)) {
        if (!r.isRentPaid) {
          pending += r.rentAmount - r.totalRentPaid;
        }
      }
    });

    return { collected, electricityCollected, pending, heldDeposits };
  }, [recordsWithRent]);

  const filteredRecords = useMemo(() => {
    return recordsWithRent.filter((r: any) => {
      // Rent Filter
      if (rentFilter === "paid" && !r.isRentPaid) return false;
      if (rentFilter === "partial" && !r.isPartialPaid) return false;
      if (rentFilter === "due" && (r.isRentPaid || r.isPartialPaid || r.isVacant || r.rentAmount <= 0)) return false;

      // Occupancy Filter
      if (occupancyFilter === "active" && r.isVacant) return false;
      if (occupancyFilter === "vacant" && !r.isVacant) return false;

      return true;
    });
  }, [recordsWithRent, rentFilter, occupancyFilter]);

  const totalPages = useMemo(() => {
    if (recordsPerPage === "all") return 1;
    return Math.ceil(filteredRecords.length / recordsPerPage);
  }, [filteredRecords.length, recordsPerPage]);

  const paginatedRecords = useMemo(() => {
    if (recordsPerPage === "all") return filteredRecords;
    const start = (currentPage - 1) * recordsPerPage;
    return filteredRecords.slice(start, start + recordsPerPage);
  }, [filteredRecords, currentPage, recordsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPropertyId, selectedCity, searchTerm, recordsPerPage, rentFilter, occupancyFilter]);

  useEffect(() => {
    const isAutoEnabled = !!store.config?.whatsappAutoRemindersEnabled;
    const hasMetaConfig = !!(
      store.config?.whatsappAccessToken && store.config?.whatsappPhoneID
    );
    const dueCount = whatsappRemindersDueDetail.count;

    if (
      !isAutoEnabled ||
      !effectiveIsAdmin ||
      !hasMetaConfig ||
      dueCount === 0 ||
      bulkReminderState.sending ||
      bulkReminderState.isOpen
    ) {
      return;
    }

    const timer = setTimeout(() => {
      // Re-evaluate
      if (
        whatsappRemindersDueDetail.list.length > 0 &&
        !bulkReminderState.sending &&
        !bulkReminderState.isOpen
      ) {
        console.log(
          `🤖 Auto-Reminder Engine: Triggering background WhatsApp reminder dispatches for ${whatsappRemindersDueDetail.list.length} accounts automatically...`,
        );
        handleTriggerBulkReminders(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    whatsappRemindersDueDetail.count,
    store.config?.whatsappAutoRemindersEnabled,
    effectiveIsAdmin,
    store.config?.whatsappAccessToken,
    store.config?.whatsappPhoneID,
    bulkReminderState.sending,
  ]);

  const unitTimeline = useMemo(() => {
    if (!historyModal.record) return [];

    // Deduplicate payments for accuracy
    const pUnique = new Map();
    (store.payments || []).forEach((p: any) => {
      if (!pUnique.has(p.id)) pUnique.set(p.id, p);
    });
    const deduplicatedPayments = Array.from(pUnique.values());

    const recordId = historyModal.record.id;
    const pHistory = deduplicatedPayments
      .filter((p: Payment) => p.recordId === recordId)
      .map((p) => ({
        ...p,
        eventType: "PAYMENT",
        timestamp: new Date(p.paidAt || p.dueDate).getTime(),
      }));

    const uHistory = store.unitHistory
      .filter((h: UnitHistory) => h.recordId === recordId)
      .map((h) => ({
        ...h,
        eventType: "TENANT_CHANGE",
        timestamp: new Date(h.effectiveFrom).getTime(),
      }));

    return [...pHistory, ...uHistory].sort((a, b) => b.timestamp - a.timestamp);
  }, [store.payments, store.unitHistory, historyModal.record]);

  const handleOpenPayment = (
    record: any,
    type: "RENT" | "DEPOSIT" | "ELECTRICITY",
  ) => {
    let amountSuggestion = 0;
    let startReading = "";
    let endReading = "";
    let perUnitCost = "";

    if (type === "RENT") {
      amountSuggestion = record.rentAmount - record.totalRentPaid;
    } else if (type === "DEPOSIT") {
      amountSuggestion = record.depositAmount - record.totalDepositPaid;
    } else if (type === "ELECTRICITY") {
      // Find previous electricity payment to get start reading
      const elecPayments = store.payments
        .filter(
          (p: any) =>
            p.recordId === record.id &&
            p.type === "ELECTRICITY" &&
            p.endReading !== undefined,
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.paidAt || b.dueDate).getTime() -
            new Date(a.paidAt || a.dueDate).getTime(),
        );

      const lastPayment = elecPayments[0];
      startReading = lastPayment ? String(lastPayment.endReading) : "0";
      perUnitCost = lastPayment ? String(lastPayment.perUnitCost) : "";
      amountSuggestion = 0;
    }

    if (amountSuggestion < 0) amountSuggestion = 0;

    /**
     * LOGIC FIX: Sync Settlement Date with Selected Ledger Month
     * If the user is viewing May 2024, the date should default to May.
     */
    const now = new Date();
    // Use local date format YYYY-MM-DD
    const localDate = now.toLocaleDateString("en-CA");
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let defaultDate = "";
    if (selectedMonth === currentMonthKey) {
      defaultDate = localDate;
    } else {
      defaultDate = `${selectedMonth}-01`;
    }

    setPaymentModal({
      isOpen: true,
      record,
      type,
      amount: amountSuggestion > 0 ? amountSuggestion : "",
      paidTo: store.config.paidToOptions?.[0] || "",
      mode: store.config.paymentModeOptions?.[0] || "",
      date: defaultDate,
      time: now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      startReading,
      endReading,
      perUnitCost,
    });
  };

  const handleOpenRevert = (
    record: any,
    type: "RENT" | "DEPOSIT" | "ELECTRICITY",
  ) => {
    setRevertModal({
      isOpen: true,
      record,
      type,
      monthKey:
        type === "RENT" || type === "ELECTRICITY" ? selectedMonth : "ONE_TIME",
    });
  };

  const handleConfirmRevert = () => {
    const { record, monthKey, type } = revertModal;
    store.togglePayment(
      record.id,
      monthKey,
      0,
      "",
      { historyId: record.historyId },
      type,
    );
    setRevertModal({ ...revertModal, isOpen: false });
  };

  const handleCollect = () => {
    const {
      record,
      type,
      amount,
      paidTo,
      mode,
      date,
      time,
      startReading,
      endReading,
      perUnitCost,
    } = paymentModal;
    const numAmount = parseFloat(String(amount)) || 0;

    // Validation for Electricity
    if (type === "ELECTRICITY") {
      if (startReading === "" || endReading === "" || perUnitCost === "") {
        alert("Please enter both readings and cost per unit.");
        return;
      }
      if (parseFloat(endReading) < parseFloat(startReading)) {
        alert("End reading cannot be less than start reading.");
        return;
      }
    }

    // Validation: Prevent collecting more than remaining balance for Rent/Deposit
    if (type === "RENT") {
      const remainingRent = record.rentAmount - record.totalRentPaid;
      if (numAmount > remainingRent) {
        alert(
          `Collection exceeds remaining balance. Max allowed: ₹${remainingRent}`,
        );
        return;
      }
    } else if (type === "DEPOSIT") {
      const remainingDeposit = record.depositAmount - record.totalDepositPaid;
      if (numAmount > remainingDeposit) {
        alert(
          `Collection exceeds remaining balance. Max allowed: ₹${remainingDeposit}`,
        );
        return;
      }
    }

    if (numAmount < 0 || (type !== "ELECTRICITY" && numAmount === 0)) {
      alert("Please enter a valid amount.");
      return;
    }

    const monthKey =
      type === "RENT" || type === "ELECTRICITY" ? selectedMonth : "ONE_TIME";

    const paymentData: any = {
      recordId: record.id,
      historyId: record.historyId,
      month: monthKey,
      amount: numAmount,
      dueDate: date,
      status: PaymentStatus.PAID,
      type,
      paidTo,
      paymentMode: mode,
      paidAt:
        time.split(":").length === 2 ? `${date}T${time}:00` : `${date}T${time}`,
      isRefunded: false,
    };

    if (type === "ELECTRICITY") {
      paymentData.startReading = parseFloat(startReading);
      paymentData.endReading = parseFloat(endReading);
      paymentData.perUnitCost = parseFloat(perUnitCost);
    }

    store.addPayment(paymentData);

    setPaymentModal({ ...paymentModal, isOpen: false });
  };

  const handleRefundDeposit = (record: any) => {
    // Record the negative amount to balance the ledger
    const now = new Date();
    store.addPayment({
      recordId: record.id,
      historyId: record.historyId,
      month: "ONE_TIME",
      amount: -record.totalDepositPaid,
      dueDate: now.toISOString().split("T")[0],
      paidAt: now.toISOString(),
      status: PaymentStatus.PAID,
      type: "DEPOSIT",
      paymentMode: "Cash",
      isRefunded: true,
      notes: "Security Deposit Refunded",
    });
    setRefundConfirm({ isOpen: false, record: null });
  };

  const handleSaveTemporalAction = () => {
    const { type, record, formValues, effectiveDate, effectiveTime } =
      temporalAction;

    if (type === "TENANT") {
      const errors: any = {};
      record.propertyType?.columns.forEach((col: ColumnDefinition) => {
        const val = String(formValues[col.id] || "").trim();

        const isRentField = col.isRentCalculatable;
        const isDepositField = col.type === ColumnType.SECURITY_DEPOSIT;
        const isStatusField = col.type === ColumnType.OCCUPANCY_STATUS;
        const isNameField = col.name.toLowerCase().includes("name");
        const isPhoneField =
          col.type === ColumnType.PHONE ||
          col.name.toLowerCase().includes("phone") ||
          (col.name.toLowerCase().includes("number") &&
            !col.isRentCalculatable);

        // Only enforce requirements for Rent, Deposit, Status and Name
        const isMandatory =
          isRentField || isDepositField || isStatusField || isNameField;

        if (isMandatory && !val) {
          errors[col.id] = "This field is required";
        } else if (val && isPhoneField) {
          if (val.replace(/\D/g, "").length !== 10) {
            errors[col.id] = "Must be exactly 10 digits";
          }
        }
      });

      if (Object.keys(errors).length > 0) {
        setTemporalAction({ ...temporalAction, errors });
        return;
      }
    }

    const values: RecordValue[] = Object.entries(formValues).map(
      ([colId, val]) => ({
        id: "v" + Date.now() + Math.random().toString(36).substr(2, 5),
        recordId: record.id,
        columnId: colId,
        value: String(val),
      }),
    );

    const combinedEffectiveFrom =
      effectiveTime.split(":").length === 2
        ? `${effectiveDate}T${effectiveTime}:00`
        : `${effectiveDate}T${effectiveTime}`;
    store.updateRecord(record.id, values, combinedEffectiveFrom);
    setTemporalAction({ ...temporalAction, isOpen: false, errors: {} });
  };

  const handleSaveNotes = async () => {
    if (!notesModal.record) return;
    await store.updateRecordNotes(notesModal.record.id, notesModal.text);
    setNotesModal({ isOpen: false, record: null, text: "" });
  };

  const [monthYearName, yearName] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1);
    return [date.toLocaleString("default", { month: "long" }), y];
  }, [selectedMonth]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Ledger Engine
            </div>
            {isAdmin && (
              <button
                onClick={() => setConfigModal({ ...configModal, isOpen: true })}
                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm transition-all hover:bg-indigo-50"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            {t("rent_collection")}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={jumpToToday}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
          >
            {t("today")}
          </button>

          <button
            onClick={() => setDetectorOpen(!detectorOpen)}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center gap-2 ${
              detectorOpen 
                ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${detectorOpen ? "animate-pulse" : "text-indigo-500"}`} />
            <span>Smart Auto-Detect</span>
          </button>

          {(() => {
            const { count } = whatsappRemindersDueDetail;
            const hasMetaConfig = !!(
              store.config?.whatsappAccessToken && store.config?.whatsappPhoneID
            );
            if (!hasMetaConfig || count === 0) return null;
            return (
              <button
                onClick={handleTriggerBulkReminders}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-100 flex items-center gap-2 animate-in slide-in-from-right-5"
              >
                <MessageSquare className="w-4 h-4 text-indigo-200 animate-pulse" />
                <span>Bulk WhatsApp Remind</span>
                <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                  {count} due
                </span>
              </button>
            );
          })()}

          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2.5 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 flex flex-col items-center min-w-[140px]">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                {yearName}
              </span>
              <span className="text-sm font-black text-slate-900 uppercase">
                {monthYearName}
              </span>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2.5 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              className="pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all min-w-[280px] shadow-sm"
              placeholder="Search units or tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Smart Payment Detector Component */}
      {detectorOpen && (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-10 duration-500">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10 select-none pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-indigo-500 to-teal-400 text-[10px] px-2.5 py-1 text-white font-black uppercase tracking-widest rounded-full shadow-sm">
                  Smart Engine
                </span>
                <span className="text-white/40 text-[10px] font-mono font-black uppercase">v2.1 Stable</span>
              </div>
              <h2 className="text-2xl font-black text-white hover:text-indigo-300 transition-colors tracking-tight uppercase">
                Rent Automatic Detector Hub
              </h2>
              <p className="text-xs text-slate-400 max-w-xl font-medium">
                Scan bank credit alerts from Gmail or parse Excel/CSV credit listings to match bank transfers and auto reconcile tenant files instantenously.
              </p>
            </div>

            <div className="flex bg-slate-800 border border-white/5 rounded-2xl p-1.5 self-stretch sm:self-auto shadow-inner">
              <button
                onClick={() => {
                  setDetectorMode("gmail");
                  setDetectedTransactions([]);
                  setGmailError(null);
                }}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  detectorMode === "gmail" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:text-white"
                }`}
              >
                <Mail className="w-4 h-4" /> Gmail Scanner
              </button>
              <button
                onClick={() => {
                  setDetectorMode("statement");
                  setDetectedTransactions([]);
                  setGmailError(null);
                }}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  detectorMode === "statement" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:text-white"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Bank Statement
              </button>
            </div>
          </div>

          <div className="mt-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
              <h3 className="text-sm font-black text-indigo-400 uppercase tracking-wider">
                Reconciliation Setup
              </h3>

              {detectorMode === "gmail" ? (
                <div className="space-y-4">
                  {/* Google Authenticator Section */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                      Google OAuth Protection
                    </label>
                    {store.googleAccessToken ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
                        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold">Live API Ready</p>
                          <p className="text-[10px] text-emerald-400/80 font-medium">Authorized via secure token.</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await store.linkGmailAccount();
                          } catch (err: any) {
                            alert("Gmail auth failed: " + err.message);
                          }
                        }}
                        className="w-full py-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-3 font-mono"
                      >
                        {/* Material gsi button asset */}
                        <svg className="w-4 h-4 shrink-0" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        </svg>
                        <span>Link Gmail Account</span>
                      </button>
                    )}
                  </div>

                  {/* Settings Query */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                      Gmail Search Query
                    </label>
                    <input
                      value={detectorQuery}
                      onChange={(e) => setDetectorQuery(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold text-white outline-none focus:border-indigo-500 transition-all font-mono"
                      placeholder="Gmail Search parameter..."
                    />
                  </div>

                  {/* Simulation Sandbox Settings */}
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">
                        Preview Simulation
                      </label>
                      <button
                        onClick={() => setIsSandboxMode(!isSandboxMode)}
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded transition-all ${
                          isSandboxMode ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isSandboxMode ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium font-sans">
                      Enable simulated emails mimicking live bank UPI triggers based on real tenant data inside your database. Perfect for local prototyping.
                    </p>
                  </div>

                  {/* Actions scanner */}
                  <button
                    onClick={isSandboxMode ? handleLoadSandboxData : handleScanGmail}
                    disabled={isLoadingEmails}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 font-sans"
                  >
                    {isLoadingEmails ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Querying Bank SMS Alerts...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>{isSandboxMode ? "Scan Sandbox Alerts" : "Scan Live Gmail Inbox"}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Upload box */}
                  <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-slate-800/20 hover:bg-slate-800/40 p-8 rounded-2xl text-center cursor-pointer transition-all relative">
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleStatementUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="space-y-3">
                      <div className="mx-auto w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                        <Upload className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-white font-sans">Upload Bank Statement</p>
                        <p className="text-[10px] text-slate-400 font-mono">Excel or CSV Format allowed</p>
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto font-medium leading-relaxed font-sans">
                        Drag & drop your statement here or browse local files. The parser dynamically maps date, narration, and credited payment balances!
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium font-sans">
                      💡 <strong>Smart Parser Tips:</strong> Ensure you upload a statement where deposit transactions are represented as positive currency credits. The system automatically searches for dates, remarks, references, and amounts!
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-wider">
                  Scanning ledger output
                </h3>
                <span className="text-[11px] font-mono font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg">
                  {detectedTransactions.filter(tx => !approvedTxIds.has(tx.id)).length} alerts found
                </span>
              </div>

              {gmailError && (
                <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                  <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                  <p className="text-sm font-bold text-white max-w-sm font-sans">{gmailError}</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1 font-sans">If using live scanner, please check your in-memory tokens or search strings.</p>
                </div>
              )}

              {detectedTransactions.length === 0 && !gmailError ? (
                <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-8 text-slate-400 select-none">
                  <CreditCard className="w-12 h-12 text-slate-700 animate-pulse mb-3" />
                  <p className="text-sm font-bold text-slate-300 font-sans">No Transactions Detected</p>
                  <p className="text-xs max-w-xs mt-1 font-sans">
                    Select a scan parameter or upload an account spreadsheet on the left side to extract payments instantly!
                  </p>
                </div>
              ) : null}

              {detectedTransactions.length > 0 && (
                <div className="flex-1 space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                  {detectedTransactions
                    .filter(tx => !approvedTxIds.has(tx.id))
                    .map((tx) => {
                      return (
                        <div key={tx.id} className="bg-slate-800/40 border border-white/5 hover:border-indigo-500/20 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start gap-4 hover:bg-slate-800/60 transition-all animate-in fade-in zoom-in-95">
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {tx.source.includes("SIMULATED") && (
                                <span className="bg-amber-500/10 text-amber-400 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded font-mono">
                                  SIMULATION
                                </span>
                              )}
                              <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-mono px-2 py-0.5 rounded font-black">
                                {tx.date}
                              </span>
                              <span className="bg-slate-700 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded font-black">
                                {tx.utr}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-black text-white">{tx.subject}</p>
                              <p className="text-xs text-slate-400 leading-relaxed font-medium block p-3 bg-black/20 rounded-xl font-mono">
                                {tx.snippet}
                              </p>
                            </div>

                            {/* Reconcile match banner */}
                            {tx.matchedRecord ? (
                              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                                ["HIGH", "PARTIAL", "MULTI_MONTH"].includes(tx.confidence)
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                              }`}>
                                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                  <span className="font-bold uppercase tracking-wider block text-[10px] mb-0.5">
                                    {tx.confidence === "HIGH" && "🎖️ High Match Confidence"}
                                    {tx.confidence === "PARTIAL" && "🌗 Partial Rent Detected"}
                                    {tx.confidence === "MULTI_MONTH" && "⚡ Multi-Month Payment"}
                                    {tx.confidence === "RENT_ONLY" && "💡 Rent Amount Match"}
                                    {tx.confidence === "NONE" && "🔍 Suggested Allocation"}
                                  </span>
                                  <p className="font-medium text-[11px] leading-relaxed">
                                    {tx.matchReason}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                  <span className="font-bold uppercase tracking-wider block text-[10px] mb-0.5">
                                    ⚠️ No automatic match found
                                  </span>
                                  <p className="font-medium text-[11px] leading-relaxed text-slate-300">
                                    Rent amount of ₹{tx.amount.toLocaleString()} does not map directly to any tenant's expected rent. Reconcile manually using the selector below!
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Dropdown for custom allocation if they want to override match or manually match */}
                            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0 self-start sm:self-center">
                                Allocate to:
                              </span>
                              <select
                                id={`assign-${tx.id}`}
                                defaultValue={tx.matchedRecord?.id || ""}
                                className="bg-slate-800 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:border-indigo-500 outline-none w-full sm:w-auto font-bold font-sans"
                              >
                                <option value="">-- Choose Tenant Unit --</option>
                                {recordsWithRent
                                  .filter((r: any) => !r.isRentPaid)
                                  .map((r: any) => (
                                    <option key={r.id} value={r.id}>
                                      {r.tenantName} ({r.propertyName}) - Expected ₹{parseFloat(r.rentValue).toLocaleString()}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="sm:self-center shrink-0 flex flex-col items-end gap-2">
                            <div className="text-right">
                              <span className="text-[10px] font-black text-slate-400 block uppercase tracking-widest leading-none mb-1 font-sans">
                                Credits Checked
                              </span>
                              <span className="text-xl font-black text-emerald-400 font-mono">
                                ₹{tx.amount.toLocaleString()}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const sel = document.getElementById(`assign-${tx.id}`) as HTMLSelectElement;
                                const chosenId = sel?.value;
                                handleApproveTransaction(tx, chosenId);
                              }}
                              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 font-sans"
                            >
                              <Check className="w-3.5 h-3.5" /> Reconcile
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COLLECTION CONFIG MODAL */}
      {configModal.isOpen && isAdmin && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <Settings className="w-6 h-6 text-indigo-200" />
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Collection Parameters
                </h3>
              </div>
              <button
                onClick={() =>
                  setConfigModal({ ...configModal, isOpen: false })
                }
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-indigo-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Target Recipients
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Petty Cash"
                      value={configModal.newPaidTo}
                      onChange={(e) =>
                        setConfigModal({
                          ...configModal,
                          newPaidTo: e.target.value,
                        })
                      }
                    />
                    <button
                      onClick={handleAddPaidTo}
                      className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(store.config.paidToOptions || []).map(
                    (opt: string, index: number) => (
                      <div
                        key={opt + index}
                        className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 group gap-2"
                      >
                        {configModal.editingPaidTo?.original === opt ? (
                          <div className="flex-1 flex gap-1">
                            <input
                              autoFocus
                              className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none"
                              value={configModal.editingPaidTo.current}
                              onChange={(e) =>
                                setConfigModal({
                                  ...configModal,
                                  editingPaidTo: {
                                    ...configModal.editingPaidTo!,
                                    current: e.target.value,
                                  },
                                })
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleSavePaidToEdit()
                              }
                            />
                            <button
                              onClick={handleSavePaidToEdit}
                              className="p-1.5 bg-emerald-500 text-white rounded-md"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() =>
                                setConfigModal({
                                  ...configModal,
                                  editingPaidTo: null,
                                })
                              }
                              className="p-1.5 bg-slate-200 text-slate-500 rounded-md"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-[11px] font-black uppercase text-slate-600 truncate flex-1">
                              {opt}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMovePaidTo(index, "up")}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                disabled={
                                  index ===
                                  (store.config.paidToOptions || []).length - 1
                                }
                                onClick={() => handleMovePaidTo(index, "down")}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfigModal({
                                    ...configModal,
                                    editingPaidTo: {
                                      original: opt,
                                      current: opt,
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-indigo-600"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemovePaidTo(opt)}
                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Payment Channels
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. UPI/QR"
                      value={configModal.newMode}
                      onChange={(e) =>
                        setConfigModal({
                          ...configModal,
                          newMode: e.target.value,
                        })
                      }
                    />
                    <button
                      onClick={handleAddMode}
                      className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(store.config.paymentModeOptions || []).map(
                    (opt: string, index: number) => (
                      <div
                        key={opt + index}
                        className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 group gap-2"
                      >
                        {configModal.editingMode?.original === opt ? (
                          <div className="flex-1 flex gap-1">
                            <input
                              autoFocus
                              className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none"
                              value={configModal.editingMode.current}
                              onChange={(e) =>
                                setConfigModal({
                                  ...configModal,
                                  editingMode: {
                                    ...configModal.editingMode!,
                                    current: e.target.value,
                                  },
                                })
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleSaveModeEdit()
                              }
                            />
                            <button
                              onClick={handleSaveModeEdit}
                              className="p-1.5 bg-emerald-500 text-white rounded-md"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() =>
                                setConfigModal({
                                  ...configModal,
                                  editingMode: null,
                                })
                              }
                              className="p-1.5 bg-slate-200 text-slate-500 rounded-md"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-[11px] font-black uppercase text-slate-600 truncate flex-1">
                              {opt}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveMode(index, "up")}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                disabled={
                                  index ===
                                  (store.config.paymentModeOptions || [])
                                    .length -
                                    1
                                }
                                onClick={() => handleMoveMode(index, "down")}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfigModal({
                                    ...configModal,
                                    editingMode: {
                                      original: opt,
                                      current: opt,
                                    },
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-indigo-600"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveMode(opt)}
                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            {/* Meta WhatsApp Cloud API Section */}
            <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-8 space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Official Meta WhatsApp Cloud API Setup
                </h4>
              </div>
              <p className="text-[11px] font-bold text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                💡 <strong>System Mode Enabled:</strong> Store credentials to
                trigger direct WhatsApp reminders from the browser. For
                templates, Meta binds parameters sequentially:
                <span className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded ml-1">
                  {"{{1}}"} Tenant Name
                </span>
                ,
                <span className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded ml-1">
                  {"{{2}}"} Rent Amount
                </span>
                ,
                <span className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded ml-1">
                  {"{{3}}"} Asset Name
                </span>
                ,
                <span className="text-indigo-600 font-mono text-[10px] bg-indigo-50 px-1 py-0.5 rounded ml-1">
                  {"{{4}}"} Date/Month
                </span>
                .
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Meta System Access Token
                  </label>
                  <input
                    type="password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="E.g. EAAGy..."
                    value={store.config?.whatsappAccessToken || ""}
                    onChange={(e) =>
                      store.updateConfig({
                        whatsappAccessToken: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    WhatsApp Phone Number ID
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="E.g. 104523952..."
                    value={store.config?.whatsappPhoneID || ""}
                    onChange={(e) =>
                      store.updateConfig({ whatsappPhoneID: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    WhatsApp Template Name
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="E.g. rent_reminder"
                    value={store.config?.whatsappTemplateName || ""}
                    onChange={(e) =>
                      store.updateConfig({
                        whatsappTemplateName: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Reminder Gating Frequency (Interval)
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    value={store.config?.whatsappReminderIntervalDays || 3}
                    onChange={(e) =>
                      store.updateConfig({
                        whatsappReminderIntervalDays: Number(e.target.value),
                      })
                    }
                  >
                    <option value={1}>Send daily</option>
                    <option value={2}>Send every 2 days</option>
                    <option value={3}>Send every 3 days (Recommended)</option>
                    <option value={4}>Send every 4 days</option>
                    <option value={5}>Send every 5 days</option>
                    <option value={7}>Send once a week (7 days)</option>
                    <option value={10}>Send every 10 days</option>
                  </select>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Zero Interaction Auto Mode (Auto-Send)
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    value={store.config?.whatsappAutoRemindersEnabled ? "true" : "false"}
                    onChange={(e) =>
                      store.updateConfig({
                        whatsappAutoRemindersEnabled: e.target.value === "true",
                      })
                    }
                  >
                    <option value="false">🔴 Disabled (Requires manual confirmation / click)</option>
                    <option value="true">🟢 Enabled (Auto-scan & background dispatch reminders when opened) 🚀</option>
                  </select>
                  <p className="text-[10px] text-slate-400 font-bold ml-1 leading-normal">
                    💡 <strong>Hands-free:</strong> Automatically dispatches official WhatsApp messages to unpaid overdue accounts based on your Reminder Gating Frequency. No clicks required.
                  </p>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-3 border-t border-slate-100 pt-6 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                      Meta API Status & Diagnostics (स्थिति जाँच)
                    </label>
                    <button
                      type="button"
                      onClick={handleTestWhatsappConnection}
                      disabled={whatsappConnectionState.status === "testing"}
                      className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      {whatsappConnectionState.status === "testing" ? (
                        <>
                          <span className="w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "🔌 Test Connection"
                      )}
                    </button>
                  </div>

                  {whatsappConnectionState.status === "idle" && (
                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] font-bold text-slate-500 flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse shrink-0"></span>
                      Not tested yet. Key inputs check are ready. Click "Test Connection" to check if keys are active properly.
                    </div>
                  )}

                  {whatsappConnectionState.status === "testing" && (
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[11px] font-bold text-indigo-600 flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping shrink-0"></span>
                      Pinging Meta Graph servers... Checking Token state and Phone Number registration status...
                    </div>
                  )}

                  {whatsappConnectionState.status === "success" && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2.5 text-emerald-800 font-extrabold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>✅ Connected & Properly Active (सफलतापूर्वक कनेक्टेड है)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pl-6 text-[10px] font-bold text-emerald-950">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-emerald-600 block">Verified Name</span>
                          <span className="font-extrabold text-slate-900">{whatsappConnectionState.verifiedName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-emerald-600 block">Display Number</span>
                          <span className="font-extrabold text-slate-900">{whatsappConnectionState.phoneNumber}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {whatsappConnectionState.status === "error" && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 text-left">
                      <div className="flex items-center gap-2.5 text-rose-800 font-extrabold text-xs">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>❌ Meta Graph API Error (कनेक्शन त्रुटि)</span>
                      </div>
                      <p className="pl-6 text-[11px] font-bold text-rose-700 leading-relaxed whitespace-pre-wrap">
                        {whatsappConnectionState.errorMessage}
                      </p>
                      <div className="pl-6 text-[10px] text-rose-600 leading-normal font-bold bg-white/40 p-2.5 rounded-lg border border-rose-100">
                        💡 <strong>Setup Checklist:</strong><br />
                        1. Verify that your temporary or permanent System User Access Token is active.<br />
                        2. Make sure the 15-digit Phone ID is accurate (don't mix it up with WhatsApp Business Account ID).<br />
                        3. Make sure the Meta token has standard <code className="bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-mono text-[9px]">whatsapp_business_messaging</code> permission.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() =>
                  setConfigModal({ ...configModal, isOpen: false })
                }
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            label: t("settled_rent"),
            value: ledgerStats.collected,
            icon: Wallet,
            color: "emerald",
            sub: `${Math.round((ledgerStats.collected / (ledgerStats.collected + ledgerStats.pending || 1)) * 100)}% ${t("collection_rate")}`,
          },
          {
            label: t("elec_revenue"),
            value: ledgerStats.electricityCollected,
            icon: Zap,
            color: "amber",
            sub: t("utility_settlements"),
          },
          {
            label: t("pending_liquidity"),
            value: ledgerStats.pending,
            icon: ArrowUpRight,
            color: "rose",
            sub: t("receivables_outstanding"),
          },
          {
            label: t("security_collect"),
            value: ledgerStats.heldDeposits,
            icon: ShieldCheck,
            color: "indigo",
            sub: t("protected_funds"),
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-5">
              <div
                className={`w-14 h-14 bg-${stat.color}-50 text-${stat.color}-600 rounded-2xl flex items-center justify-center shadow-inner`}
              >
                <stat.icon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <h3 className="text-xl font-black text-slate-950">
                  ₹{stat.value.toLocaleString()}
                </h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                  {stat.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between bg-slate-50/30 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              {t("financial_unit_ledger")}
            </h2>
          </div>
          <div className="flex items-center gap-6 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2 lg:mx-0 lg:px-0">
            <div className="flex items-center gap-3 shrink-0">
              <MapPin className="w-4 h-4 text-slate-400" />
              <select
                className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedPropertyId("all"); // Reset property filter when city changes
                }}
              >
                <option value="all">
                  {t("view_all_cities") || "All Cities"}
                </option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Layers className="w-4 h-4 text-slate-400" />
              <select
                className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                value={recordsPerPage}
                onChange={(e) =>
                  setRecordsPerPage(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  )
                }
              >
                <option value={25}>Show 25</option>
                <option value={50}>Show 50</option>
                <option value="all">Show All</option>
              </select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <option value="all">{t("view_all_properties")}</option>
                {visibleProperties
                  .filter(
                    (p) => selectedCity === "all" || p.city === selectedCity,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Wallet className="w-4 h-4 text-slate-400" />
              <select
                className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                value={rentFilter}
                onChange={(e) => setRentFilter(e.target.value)}
              >
                <option value="all">{t("all_statuses") || "All Statuses"}</option>
                <option value="due">{t("rent_due") || "Rent Due"}</option>
                <option value="paid">{t("paid") || "Paid"}</option>
                <option value="partial">{t("partial_paid") || "Partial Paid"}</option>
              </select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                className="text-xs font-black uppercase text-slate-700 outline-none bg-transparent cursor-pointer hover:text-indigo-600 transition-colors"
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
              >
                <option value="all">{t("all_units") || "All Units"}</option>
                <option value="active">{t("active") || "Active"}</option>
                <option value="vacant">{t("vacant") || "Vacant"}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[800px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
              <tr className="bg-white">
                <th className="px-2 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border-r border-slate-50">
                  {t("unit_and_member")} ({filteredRecords.length})
                </th>

                <th className="px-2 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  {t("rent_status")}
                </th>
                <th className="px-2 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  {t("electricity")}
                </th>
                <th className="px-2 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  {t("security")}
                </th>
                <th className="px-2 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  {t("ops")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedRecords.map((record) => (
                <tr
                  key={record.id}
                  className={`group hover:bg-slate-50/50 transition-all ${record.isVacant && !record.isRentPaid ? "opacity-60 bg-slate-50/30" : ""}`}
                >
                  <td className="px-2 py-3 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-50">
                    <button
                      onClick={() =>
                        setUnitDetailsModal({ isOpen: true, record })
                      }
                      className="flex items-center gap-2 text-left group/unit w-full"
                    >
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 shadow-inner group-hover/unit:bg-indigo-600 group-hover/unit:text-white transition-all">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-[12px] font-black text-slate-900 uppercase truncate max-w-[120px] group-hover/unit:text-indigo-600 transition-colors">
                          {record.property?.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tight truncate max-w-[70px]">
                            {record.tenantName}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover/unit:text-slate-600">
                            {t("details")}
                          </span>
                        </div>
                      </div>
                    </button>
                  </td>

                  <td className="px-1 md:px-3 py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        disabled={
                          !canEdit || (record.isVacant && !record.isRentPaid)
                        }
                        onClick={() =>
                          record.isRentPaid
                            ? handleOpenRevert(record, "RENT")
                            : handleOpenPayment(record, "RENT")
                        }
                        className={`min-w-[90px] md:min-w-[115px] px-1.5 md:px-2 py-1.5 rounded-lg text-[7px] md:text-[8.5px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1 md:gap-1.5 mx-auto ${record.isRentPaid ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-700" : record.isPartialPaid ? "bg-amber-50 text-amber-700 border-amber-100" : record.statusBadge === "OVERDUE" ? "bg-rose-50 text-rose-700 border-rose-100" : record.isVacant ? "bg-slate-50 text-slate-200 border-slate-100 opacity-50" : "bg-slate-50 text-slate-400 border-slate-100"}`}
                      >
                        {record.isRentPaid ? (
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[6px] md:text-[7.5px] opacity-50 mb-0.5 whitespace-nowrap">
                              {t("settled")}
                            </span>
                            <span className="flex items-center gap-1 font-black">
                              <RotateCcw className="w-2.5 md:w-3 h-2.5 md:h-3" />{" "}
                              {t("return")}
                            </span>
                          </div>
                        ) : (
                          <>
                            {record.statusBadge === "OVERDUE" ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : record.isVacant ? (
                              <Ban className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            <span className="whitespace-nowrap">
                              {record.isVacant && !record.isRentPaid
                                ? t("n_a")
                                : record.isPartialPaid
                                  ? t("balance")
                                  : t("collect_rent")}
                            </span>
                          </>
                        )}
                      </button>
                      {record.isPartialPaid && (
                        <div className="flex items-center gap-1 px-2 md:px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                          <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                          <span className="text-[7.5px] md:text-[9px] font-black text-amber-600 uppercase tracking-tighter whitespace-nowrap">
                            ₹{record.totalRentPaid} / ₹{record.rentAmount}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-1 md:px-3 py-4 text-center">
                    <button
                      disabled={
                        !canEdit ||
                        (record.isVacant && !record.isElectricityPaid)
                      }
                      onClick={() =>
                        record.isElectricityPaid
                          ? handleOpenRevert(record, "ELECTRICITY")
                          : handleOpenPayment(record, "ELECTRICITY")
                      }
                      className={`min-w-[90px] md:min-w-[115px] px-1.5 md:px-2 py-1.5 rounded-lg text-[7px] md:text-[8.5px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1 md:gap-1.5 mx-auto ${record.isElectricityPaid ? "bg-amber-50 text-amber-700 border-amber-100 hover:bg-rose-50 hover:text-rose-700" : record.isVacant ? "bg-slate-50 text-slate-200 border-slate-100 opacity-50" : "bg-slate-50 text-slate-400 border-slate-100"}`}
                    >
                      {record.isElectricityPaid ? (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[6px] md:text-[7px] opacity-50 font-bold whitespace-nowrap">
                            ₹{record.totalElectricityPaid} {t("settled")}
                          </span>
                          <span className="flex items-center gap-1 font-black">
                            <RotateCcw className="w-2 md:w-2.5 h-2 md:h-2.5" />{" "}
                            {t("return")}
                          </span>
                        </div>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          <span className="whitespace-nowrap">
                            {record.isVacant && !record.isElectricityPaid
                              ? t("n_a")
                              : t("electricity")}
                          </span>
                        </>
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        disabled={
                          !canEdit ||
                          (record.isVacant &&
                            !record.isDepositPaid &&
                            !record.isDepositRefunded)
                        }
                        onClick={() =>
                          record.isDepositPaid
                            ? handleOpenRevert(record, "DEPOSIT")
                            : handleOpenPayment(record, "DEPOSIT")
                        }
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (record.isDepositPaid && canEdit)
                            setRefundConfirm({ isOpen: true, record });
                        }}
                        className={`min-w-[90px] md:min-w-[115px] px-1.5 md:px-2 py-1.5 rounded-lg text-[7px] md:text-[8.5px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1 md:gap-1.5 mx-auto ${record.isDepositPaid ? "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-rose-50 hover:text-rose-700" : record.isDepositPartialPaid ? "bg-amber-50 text-amber-700 border-amber-100" : record.isVacant && !record.isDepositRefunded ? "bg-slate-50 text-slate-200 border-slate-100 opacity-50" : "bg-slate-50 text-slate-400 border-slate-100"}`}
                      >
                        {record.isDepositPaid ? (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-[7px] opacity-50 font-bold">
                              {t("secured")}
                            </span>
                            <span className="flex items-center gap-1 font-black">
                              <RotateCcw className="w-2.5 h-2.5" />{" "}
                              {t("return")}
                            </span>
                          </div>
                        ) : (
                          <>
                            <Landmark className="w-3 h-3" />
                            {record.isDepositRefunded
                              ? t("refunded")
                              : record.isVacant && !record.isDepositPartialPaid
                                ? t("n_a")
                                : record.isDepositPartialPaid
                                  ? t("balance")
                                  : t("security")}
                          </>
                        )}
                      </button>
                      {record.isDepositPartialPaid && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                          <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">
                            Paid: ₹{record.totalDepositPaid} / ₹
                            {record.depositAmount}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-2 py-3 text-right">
                    <div className="flex justify-end gap-1.5 transition-all">
                      <button
                        onClick={() =>
                          setNotesModal({
                            isOpen: true,
                            record,
                            text: record.notes || "",
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors bg-white rounded-lg shadow-sm"
                        title="Notes"
                      >
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                      {(() => {
                        const phoneCol = record.propertyType?.columns.find(
                          (col: any) =>
                            col.type === ColumnType.PHONE ||
                            col.name.toLowerCase().includes("phone") ||
                            (col.name.toLowerCase().includes("number") &&
                              !col.isRentCalculatable),
                        );
                        const tenantPhone =
                          record.rawValuesMap?.[phoneCol?.id || ""] || "";
                        const isPendingOrOverdue =
                          !record.isRentPaid && !record.isVacant;

                        if (tenantPhone && isPendingOrOverdue) {
                          return (
                            <button
                              onClick={() =>
                                handleOpenReminder(record, tenantPhone)
                              }
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:scale-105 hover:bg-emerald-100 transition-all bg-emerald-50 rounded-lg shadow-sm border border-emerald-100 flex items-center justify-center animate-pulse"
                              title={t("Send Reminder") || "Send Rent Reminder"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          );
                        }
                        return null;
                      })()}
                      <button
                        onClick={() =>
                          setHistoryModal({ isOpen: true, record })
                        }
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors bg-white rounded-lg shadow-sm"
                        title="History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => {
                              const freshValues: any = {};
                              record.propertyType?.columns.forEach(
                                (col: any) => {
                                  freshValues[col.id] = "";
                                },
                              );
                              const statusCol =
                                record.propertyType?.columns.find(
                                  (c: any) =>
                                    c.type === ColumnType.OCCUPANCY_STATUS,
                                );
                              if (statusCol)
                                freshValues[statusCol.id] = "Active";

                              const rentDateCol =
                                record.propertyType?.columns.find(
                                  (c: any) =>
                                    c.name.toLowerCase() === "rent date",
                                );
                              const today = new Date().toLocaleDateString(
                                "en-CA",
                              );
                              if (rentDateCol)
                                freshValues[rentDateCol.id] = today;

                              setTemporalAction({
                                isOpen: true,
                                type: "TENANT",
                                record,
                                formValues: freshValues,
                                effectiveDate: today,
                                effectiveTime: new Date().toLocaleTimeString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  },
                                ),
                                errors: {},
                              });
                            }}
                            disabled={
                              !(
                                (record.isVacant || record.isRentPaid) &&
                                (record.isVacant ||
                                  !record.isDepositPaid ||
                                  record.isDepositRefunded ||
                                  record.depositAmount === 0)
                              )
                            }
                            className={`p-1.5 rounded-lg shadow-sm transition-all ${(record.isVacant || record.isRentPaid) && (record.isVacant || !record.isDepositPaid || record.isDepositRefunded || record.depositAmount === 0) ? "text-slate-400 hover:text-emerald-600 bg-white" : "text-slate-200 bg-slate-50 cursor-not-allowed"}`}
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          {(() => {
                            const isRentClear =
                              record.isVacant || record.isRentPaid;
                            const isDepositClear =
                              record.isVacant ||
                              !record.isDepositPaid ||
                              record.isDepositRefunded ||
                              record.depositAmount === 0;
                            const canAddTenant = isRentClear && isDepositClear;
                            if (!canAddTenant)
                              return (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                              );
                            return null;
                          })()}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recordsPerPage !== "all" && totalPages > 1 && (
          <div className="px-8 py-5 border-t border-slate-50 flex items-center justify-between bg-slate-50/10">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t("showing")}{" "}
                <span className="text-slate-900">
                  {(currentPage - 1) * (recordsPerPage as number) + 1}
                </span>{" "}
                {t("to")}{" "}
                <span className="text-slate-900">
                  {Math.min(
                    currentPage * (recordsPerPage as number),
                    filteredRecords.length,
                  )}
                </span>{" "}
                {t("of")}{" "}
                <span className="text-slate-900">{filteredRecords.length}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:text-indigo-600 hover:shadow-sm active:scale-95"}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Page
                </span>
                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest px-2 py-1 bg-indigo-50 rounded-md border border-indigo-100">
                  {currentPage}
                </span>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  of
                </span>
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                  {totalPages}
                </span>
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-white hover:text-indigo-600 hover:shadow-sm active:scale-95"}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REVERT DIALOG */}
      {revertModal.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-10 text-center bg-rose-50 border-b border-rose-100">
              <div className="w-20 h-20 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-600/20">
                <RotateCcw className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">
                Reverse Protocol?
              </h3>
              <p className="text-sm font-bold text-slate-500 mt-3 leading-relaxed">
                Roll back transaction for{" "}
                <strong>{revertModal.record.tenantName}</strong>? This cannot be
                easily undone.
              </p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button
                onClick={() =>
                  setRevertModal({ ...revertModal, isOpen: false })
                }
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-200"
              >
                Abort
              </button>
              <button
                onClick={handleConfirmRevert}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFUND CONFIRMATION */}
      {refundConfirm.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 text-center bg-amber-50 border-b border-amber-100">
              <div className="w-20 h-20 bg-amber-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">
                Refund Deposit?
              </h3>
              <p className="text-sm font-bold text-slate-500 mt-3 leading-relaxed">
                Are you sure you want to mark this deposit as refunded? This
                will allow adding a new tenant for{" "}
                <strong>{refundConfirm.record?.tenantName}</strong>.
              </p>
            </div>
            <div className="p-8 flex gap-4 bg-white">
              <button
                onClick={() =>
                  setRefundConfirm({ isOpen: false, record: null })
                }
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefundDeposit(refundConfirm.record)}
                className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTLEMENT MODAL */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div
              className={`p-10 text-white flex justify-between items-center ${paymentModal.type === "RENT" ? "bg-indigo-600" : paymentModal.type === "ELECTRICITY" ? "bg-amber-500" : "bg-emerald-600"}`}
            >
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                  {paymentModal.type === "RENT" ? (
                    <Wallet className="w-7 h-7" />
                  ) : paymentModal.type === "ELECTRICITY" ? (
                    <Zap className="w-7 h-7" />
                  ) : (
                    <ShieldCheck className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase leading-none tracking-tight">
                    Settle {paymentModal.type}
                  </h3>
                  <p className="text-[11px] font-bold text-white/60 uppercase mt-2">
                    Member: {paymentModal.record.tenantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setPaymentModal({ ...paymentModal, isOpen: false })
                }
                className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {paymentModal.type === "ELECTRICITY" && (
                <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">
                        Start Reading
                      </label>
                      <input
                        type="number"
                        className="w-full bg-white border border-amber-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                        value={paymentModal.startReading}
                        onChange={(e) => {
                          const start = e.target.value;
                          const end = paymentModal.endReading;
                          const cost = paymentModal.perUnitCost;
                          let newAmt = paymentModal.amount;
                          if (start !== "" && end !== "" && cost !== "") {
                            newAmt =
                              (parseFloat(end) - parseFloat(start)) *
                              parseFloat(cost);
                          }
                          setPaymentModal({
                            ...paymentModal,
                            startReading: start,
                            amount: newAmt,
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">
                        End Reading
                      </label>
                      <input
                        type="number"
                        className="w-full bg-white border border-amber-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                        value={paymentModal.endReading}
                        onChange={(e) => {
                          const end = e.target.value;
                          const start = paymentModal.startReading;
                          const cost = paymentModal.perUnitCost;
                          let newAmt = paymentModal.amount;
                          if (start !== "" && end !== "" && cost !== "") {
                            newAmt =
                              (parseFloat(end) - parseFloat(start)) *
                              parseFloat(cost);
                          }
                          setPaymentModal({
                            ...paymentModal,
                            endReading: end,
                            amount: newAmt,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">
                      Cost Per Unit
                    </label>
                    <input
                      type="number"
                      className="w-full bg-white border border-amber-200 rounded-2xl px-5 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
                      value={paymentModal.perUnitCost}
                      placeholder="e.g. 8"
                      onChange={(e) => {
                        const cost = e.target.value;
                        const start = paymentModal.startReading;
                        const end = paymentModal.endReading;
                        let newAmt = paymentModal.amount;
                        if (start !== "" && end !== "" && cost !== "") {
                          newAmt =
                            (parseFloat(end) - parseFloat(start)) *
                            parseFloat(cost);
                        }
                        setPaymentModal({
                          ...paymentModal,
                          perUnitCost: cost,
                          amount: newAmt,
                        });
                      }}
                    />
                  </div>
                  {paymentModal.startReading !== "" &&
                    paymentModal.endReading !== "" && (
                      <div className="flex justify-between items-center pt-2 border-t border-amber-200/50">
                        <span className="text-[10px] font-black text-amber-500 uppercase">
                          Consumption
                        </span>
                        <span className="text-sm font-black text-amber-700">
                          {Math.max(
                            0,
                            parseFloat(paymentModal.endReading) -
                              parseFloat(paymentModal.startReading),
                          )}{" "}
                          Units
                        </span>
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Capital Amount
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] pl-16 pr-6 py-6 text-3xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-inner"
                    value={paymentModal.amount}
                    placeholder="0"
                    onChange={(e) =>
                      setPaymentModal({
                        ...paymentModal,
                        amount: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Channel
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer"
                    value={paymentModal.mode}
                    onChange={(e) =>
                      setPaymentModal({ ...paymentModal, mode: e.target.value })
                    }
                  >
                    {(store.config.paymentModeOptions || []).map(
                      (opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Target Account
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer"
                    value={paymentModal.paidTo}
                    onChange={(e) =>
                      setPaymentModal({
                        ...paymentModal,
                        paidTo: e.target.value,
                      })
                    }
                  >
                    {(store.config.paidToOptions || []).map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Settlement
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={paymentModal.date}
                    onChange={(e) =>
                      setPaymentModal({ ...paymentModal, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" /> Time
                  </label>
                  <input
                    type="time"
                    step="1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={paymentModal.time}
                    onChange={(e) =>
                      setPaymentModal({ ...paymentModal, time: e.target.value })
                    }
                  />
                </div>
              </div>

              <button
                onClick={handleCollect}
                className={`w-full py-6 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 ${paymentModal.type === "RENT" ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100" : paymentModal.type === "ELECTRICITY" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"}`}
              >
                Collect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED AUDIT TIMELINE MODAL */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 z-[1200] flex justify-end p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full md:max-w-md h-full md:h-auto md:max-h-[96vh] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in slide-in-from-right-8 duration-500">
            <div className="p-6 md:p-10 bg-slate-950 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full -mr-10 -mt-10"></div>
              <div className="flex items-center gap-4 md:gap-6 relative z-10">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 backdrop-blur-xl shadow-2xl">
                  <History className="w-6 h-6 md:w-8 md:h-8 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                    Audit Trail
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-black text-indigo-400/80 uppercase mt-0.5 tracking-[0.2em]">
                    Unit Integrity & Financials
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModal({ isOpen: false, record: null })}
                className="p-2 md:p-3 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white relative z-10"
              >
                <X className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8 md:space-y-10 bg-slate-50/50">
              {unitTimeline.length > 0 ? (
                unitTimeline.map((item: any, idx) => {
                  const isTenantChange = item.eventType === "TENANT_CHANGE";
                  const pType = item.type;

                  const getPaymentIcon = () => {
                    if (isTenantChange)
                      return <User className="w-4 h-4 text-white" />;
                    if (pType === "RENT")
                      return <Wallet className="w-4 h-4 text-white" />;
                    if (pType === "ELECTRICITY")
                      return <Zap className="w-4 h-4 text-white" />;
                    if (pType === "DEPOSIT")
                      return <Landmark className="w-4 h-4 text-white" />;
                    return <DollarSign className="w-4 h-4 text-white" />;
                  };

                  const getBadgeConfig = () => {
                    if (isTenantChange)
                      return { label: "Migration Event", bg: "bg-slate-900" };
                    if (pType === "RENT")
                      return { label: "Rent Collection", bg: "bg-emerald-600" };
                    if (pType === "ELECTRICITY")
                      return { label: "Electricity Bill", bg: "bg-amber-600" };
                    if (pType === "DEPOSIT")
                      return { label: "Security Deposit", bg: "bg-indigo-600" };
                    return {
                      label: (pType || "Payment") + " Settlement",
                      bg: "bg-slate-500",
                    };
                  };

                  const config = getBadgeConfig();

                  return (
                    <div key={idx} className="relative pl-12 group/item">
                      {/* Timeline Line */}
                      {idx !== unitTimeline.length - 1 && (
                        <div className="absolute left-[17px] top-10 bottom-[-40px] w-0.5 bg-gradient-to-b from-slate-200 to-transparent"></div>
                      )}

                      {/* Indicator Dot */}
                      <div
                        className={`absolute left-0 top-1.5 w-9 h-9 rounded-full border-4 border-white shadow-xl flex items-center justify-center z-10 transition-transform group-hover/item:scale-110 ${config.bg}`}
                      >
                        {getPaymentIcon()}
                      </div>

                      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 w-2 h-full ${config.bg}`}
                        ></div>

                        <div className="flex items-center justify-between mb-5">
                          <span
                            className={`text-[9px] font-black uppercase tracking-[0.1em] px-4 py-1.5 rounded-full text-white shadow-sm ${config.bg}`}
                          >
                            {config.label}
                          </span>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {new Date(item.timestamp).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter mt-0.5">
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {isTenantChange ? (
                          <div className="space-y-5">
                            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                              <div className="flex items-center gap-2 mb-4">
                                <Layers className="w-4 h-4 text-indigo-500" />
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  Snapshot Payload
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {Object.entries(item.values).map(
                                  ([colId, val]: [string, any]) => {
                                    const col =
                                      historyModal.record?.propertyType?.columns.find(
                                        (c: any) => c.id === colId,
                                      );
                                    if (!col || !val) return null;
                                    return (
                                      <div key={colId} className="space-y-1">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-tight">
                                          {col.name}
                                        </p>
                                        <p className="text-xs font-black text-slate-900 truncate">
                                          {val}
                                        </p>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                  <CreditCard className="w-6 h-6" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900">
                                    {item.paymentMode || "System Journal"}
                                  </p>
                                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                    {item.paidTo || "Root Account"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black text-indigo-600 tracking-tighter">
                                  ₹{item.amount.toLocaleString()}
                                </p>
                                {item.month && item.month !== "ONE_TIME" && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 rounded-lg mt-1">
                                    <CalendarDays className="w-3 h-3 text-slate-400" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase">
                                      {item.month}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {item.type === "ELECTRICITY" &&
                              item.startReading !== undefined && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 flex justify-between items-center text-[10px] font-bold text-amber-700">
                                  <div className="flex gap-4">
                                    <span>S: {item.startReading}</span>
                                    <span>E: {item.endReading}</span>
                                  </div>
                                  <div className="px-2 py-0.5 bg-amber-600 text-white rounded text-[8px] font-black uppercase">
                                    ₹{item.perUnitCost}/Unit
                                  </div>
                                </div>
                              )}
                            {item.paidAt && (
                              <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>
                                  Authorized at{" "}
                                  {new Date(item.paidAt).toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-1 text-emerald-600">
                                  <ShieldCheck className="w-3 h-3" /> VERIFIED
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-24">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-8 animate-pulse text-slate-200">
                    <History className="w-12 h-12" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                    No Historical Footprint
                  </p>
                  <p className="text-[10px] font-bold text-slate-300 uppercase mt-2">
                    Transactions and migrations will appear here.
                  </p>
                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-slate-100">
              <button
                onClick={() => setHistoryModal({ isOpen: false, record: null })}
                className="w-full py-6 bg-slate-950 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPORAL ACTION MODAL (Onboard/Vacate) */}
      {temporalAction.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div
              className={`p-10 text-white flex justify-between items-center bg-indigo-600`}
            >
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                  <UserPlus className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase leading-none tracking-tight">
                    {t("member_onboarding")}
                  </h3>
                  <p className="text-[11px] font-bold text-white/60 uppercase mt-2">
                    {t("unit")}: {temporalAction.record.property?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setTemporalAction({ ...temporalAction, isOpen: false })
                }
                className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4 shadow-inner">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-500" />{" "}
                      {t("date")}
                    </label>
                    <input
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      value={temporalAction.effectiveDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const updatedValues = { ...temporalAction.formValues };

                        const rentDateCol =
                          temporalAction.record.propertyType?.columns.find(
                            (c: any) => c.name.toLowerCase() === "rent date",
                          );
                        if (rentDateCol) {
                          updatedValues[rentDateCol.id] = newDate;
                        }

                        setTemporalAction({
                          ...temporalAction,
                          effectiveDate: newDate,
                          formValues: updatedValues,
                          errors: { ...temporalAction.errors },
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" /> {t("time")}
                    </label>
                    <input
                      type="time"
                      step="1"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      value={temporalAction.effectiveTime}
                      onChange={(e) =>
                        setTemporalAction({
                          ...temporalAction,
                          effectiveTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-center mt-1">
                  This shift creates a permanent history snapshot.
                </p>
              </div>

              <div className="space-y-6">
                {temporalAction.record.propertyType?.columns.map(
                  (col: ColumnDefinition) => {
                    const isRelevant = true;

                    const isSynchronizedRentDate =
                      temporalAction.type === "TENANT" &&
                      col.name.toLowerCase() === "rent date";

                    if (!isRelevant) return null;

                    const hasError = temporalAction.errors[col.id];

                    return (
                      <div
                        key={col.id}
                        className="space-y-2 animate-in slide-in-from-top-3"
                      >
                        <label
                          className={`text-[11px] font-black uppercase tracking-widest ml-1 ${hasError ? "text-red-500" : "text-slate-400"}`}
                        >
                          {col.name} <span className="text-red-500">*</span>
                        </label>
                        {col.options ? (
                          <select
                            className={`w-full border rounded-[1.5rem] px-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer shadow-sm ${hasError ? "border-red-500 bg-red-50" : "border-slate-200 bg-slate-50"}`}
                            value={temporalAction.formValues[col.id] || ""}
                            onChange={(e) => {
                              const newErrors = { ...temporalAction.errors };
                              delete newErrors[col.id];
                              setTemporalAction({
                                ...temporalAction,
                                formValues: {
                                  ...temporalAction.formValues,
                                  [col.id]: e.target.value,
                                },
                                errors: newErrors,
                              });
                            }}
                          >
                            <option value="">{t("select_protocol")}</option>
                            {col.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                              {col.name.toLowerCase().includes("phone") ? (
                                <RotateCcw className="w-5 h-5 rotate-90" />
                              ) : col.name.toLowerCase().includes("name") ? (
                                <User className="w-5 h-5" />
                              ) : (
                                <ClipboardList className="w-5 h-5" />
                              )}
                            </div>
                            <input
                              className={`w-full border rounded-[1.5rem] pl-14 pr-6 py-5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all shadow-sm ${hasError ? "border-red-500 bg-red-50" : isSynchronizedRentDate ? "bg-slate-100 border-slate-100 text-slate-500 cursor-not-allowed" : "border-slate-200 bg-slate-50"}`}
                              placeholder={
                                isSynchronizedRentDate
                                  ? "Populated from Effective Date"
                                  : `Enter ${col.name} value`
                              }
                              value={temporalAction.formValues[col.id] || ""}
                              disabled={isSynchronizedRentDate}
                              onChange={(e) => {
                                let val = e.target.value;
                                const isPhoneOrNum =
                                  (col.name.toLowerCase().includes("phone") ||
                                    col.name
                                      .toLowerCase()
                                      .includes("number")) &&
                                  !col.isRentCalculatable;

                                if (isPhoneOrNum) {
                                  val = val.replace(/\D/g, "").slice(0, 10);
                                }

                                const newErrors = { ...temporalAction.errors };
                                delete newErrors[col.id];
                                setTemporalAction({
                                  ...temporalAction,
                                  formValues: {
                                    ...temporalAction.formValues,
                                    [col.id]: val,
                                  },
                                  errors: newErrors,
                                });
                              }}
                            />
                          </div>
                        )}
                        {hasError && (
                          <p className="text-[9px] font-black text-red-500 uppercase ml-1 animate-pulse">
                            {typeof hasError === "string"
                              ? hasError
                              : "This field is compulsory for onboarding"}
                          </p>
                        )}
                      </div>
                    );
                  },
                )}
              </div>

              <button
                onClick={handleSaveTemporalAction}
                className="w-full py-6 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 bg-indigo-600 hover:bg-indigo-700"
              >
                <Save className="w-6 h-6" /> {t("authorize_onboarding")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTES MODAL */}
      {notesModal.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 bg-amber-500 text-white flex justify-between items-center">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                  <StickyNote className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase leading-none tracking-tight">
                    {t("unit_notes")}
                  </h3>
                  <p className="text-[11px] font-bold text-white/60 uppercase mt-2">
                    Member: {notesModal.record.tenantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotesModal({ ...notesModal, isOpen: false })}
                className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/60"
              >
                <X className="w-7 h-7" />
              </button>
            </div>

            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Observations & Remarks
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-8 py-6 text-sm font-bold outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all min-h-[200px] resize-none shadow-inner"
                  placeholder="Write your notes here..."
                  value={notesModal.text}
                  onChange={(e) =>
                    setNotesModal({ ...notesModal, text: e.target.value })
                  }
                />
              </div>

              <button
                onClick={handleSaveNotes}
                className="w-full py-6 bg-amber-500 hover:bg-amber-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-xl shadow-amber-200 transition-all active:scale-95 flex items-center justify-center gap-4"
              >
                <Save className="w-6 h-6" /> {t("save_unit_notes")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* UNIT DETAILS MODAL */}
      {unitDetailsModal.isOpen && unitDetailsModal.record && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase leading-none tracking-tight">
                    {t("details")}
                  </h3>
                  <p className="text-[10px] font-bold text-white/60 uppercase mt-1.5">
                    {unitDetailsModal.record.property?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setUnitDetailsModal({ isOpen: false, record: null })
                }
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-3">
                {unitDetailsModal.record.propertyType?.columns
                  .filter((col: ColumnDefinition) => col.isDefaultInLedger)
                  .map((col: ColumnDefinition) => {
                    const value = unitDetailsModal.record.rawValuesMap[col.id];
                    return (
                      <div
                        key={col.id}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:ring-2 hover:ring-indigo-500/20 hover:shadow-lg transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5 text-slate-400 group-hover:text-indigo-600 transition-colors">
                            <Info className="w-3 h-3" />
                            <p className="text-[10px] font-bold text-inherit uppercase tracking-widest leading-none">
                              {col.name}
                            </p>
                          </div>
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            {value || "-"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() =>
                  setUnitDetailsModal({ isOpen: false, record: null })
                }
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all active:scale-95"
              >
                Close Details
              </button>
              {(() => {
                const record = unitDetailsModal.record;
                if (!record) return null;
                const phoneCol = record.propertyType?.columns.find(
                  (col: any) =>
                    col.type === ColumnType.PHONE ||
                    col.name.toLowerCase().includes("phone") ||
                    (col.name.toLowerCase().includes("number") &&
                      !col.isRentCalculatable),
                );
                const tenantPhone =
                  record.rawValuesMap?.[phoneCol?.id || ""] || "";
                if (!tenantPhone) return null;
                return (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between text-left">
                    <div>
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                        {t("rent_reminder") || "Due Rent Reminder"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {t("phone_num") || "Tenant Phone"}:{" "}
                        <span className="font-bold text-slate-800">
                          {tenantPhone}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenReminder(record, tenantPhone)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all active:scale-95"
                    >
                      <MessageSquare className="w-3.5 h-3.5 animate-bounce" />
                      {t("remind") || "Remind"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* BULK REMINDER PROGRESS LOG MODAL */}
      {bulkReminderState.isOpen && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
          {bulkReminderState.isReviewPhase ? (
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 max-h-[85vh]">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-indigo-200 animate-pulse" />
                  <div className="text-left font-black">
                    <h3 className="text-base uppercase tracking-wider leading-none">
                      Review Pending Reminders
                    </h3>
                    <p className="text-[9px] text-indigo-100 mt-1 uppercase tracking-widest font-bold">
                      WhatsApp Cloud API - Verification
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setBulkReminderState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="p-1 px-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black uppercase transition-all"
                >
                  Cancel
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-left">
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-1">
                    ⚠️ Permission Required (स्वीकृति आवश्यक)
                  </h4>
                  <p className="text-[11px] text-amber-900/80 font-bold leading-relaxed">
                    Automatic scans have found <strong>{bulkReminderState.total} accounts</strong> that are currently overdue for {selectedMonth} rent and haven't received a reminder recently. Please review the list below and grant dispatch authorization.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block text-left">
                    Recipients List ({bulkReminderState.total} Tenants)
                  </label>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {whatsappRemindersDueDetail.list.map((record: any, idx: number) => {
                      const pName = record.property?.name || "Property";
                      const tName = record.tenantName || "Tenant";
                      const rentVal = record.rentAmount ? record.rentAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : "₹0";

                      const phoneCol = record.propertyType?.columns.find(
                        (col: any) =>
                          col.type === ColumnType.PHONE ||
                          col.name.toLowerCase().includes("phone") ||
                          (col.name.toLowerCase().includes("number") &&
                            !col.isRentCalculatable),
                      );
                      const rawPhone = record.rawValuesMap?.[phoneCol?.id || ""] || "";
                      const cleanDigits = rawPhone.replace(/\D/g, "");
                      const finalPhone =
                        cleanDigits.length === 10 ? `+91 ${cleanDigits}` : rawPhone;

                      return (
                        <div
                          key={record.id || idx}
                          className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <div className="text-left space-y-1 pr-4">
                            <p className="text-xs font-black text-slate-800">
                              {tName}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                              <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black text-[8px] uppercase">{pName}</span>
                              <span>• {finalPhone}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50/50 px-2.5 py-1 rounded-xl">
                              {rentVal}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
                <button
                  onClick={() =>
                    setBulkReminderState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase transition-all active:scale-95"
                >
                  Cancel (रद्द करें)
                </button>
                <button
                  onClick={() => startSendingBulkReminders()}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send All ({bulkReminderState.total})
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 max-h-[85vh]">
              <div className="p-6 bg-slate-950 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <div className="text-left">
                    <h3 className="text-base font-black uppercase tracking-wider leading-none">
                      Bulk Dispatching Console
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                      Official Meta Cloud API Processing
                    </p>
                  </div>
                </div>
                {/* Only allow closing if execution is completed */}
                {!bulkReminderState.sending && (
                  <button
                    onClick={() =>
                      setBulkReminderState((prev) => ({ ...prev, isOpen: false }))
                    }
                    className="p-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase transition-all shadow-md shadow-indigo-900/10 active:scale-95"
                  >
                    Close Console
                  </button>
                )}
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                {/* Progress Indicator */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Progress</span>
                    <span className="text-indigo-600">
                      {bulkReminderState.currentIndex} / {bulkReminderState.total}
                    </span>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${(bulkReminderState.currentIndex / (bulkReminderState.total || 1)) * 100}%`,
                      }}
                      className="bg-indigo-600 h-full transition-all duration-300"
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {bulkReminderState.sending
                      ? `⚡ Processing dispatch ${bulkReminderState.currentIndex} of ${bulkReminderState.total}...`
                      : "🎉 Bulk dispatcher sequence finalized!"}
                  </p>
                </div>

                {/* Console System Log */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-left block">
                    Live Console System Logs
                  </label>
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[10px] min-h-[180px] max-h-[250px] overflow-y-auto space-y-1.5 custom-scrollbar text-left leading-normal">
                    {bulkReminderState.logs.length === 0 && (
                      <div className="text-slate-500 animate-pulse">
                        Initializing system handshakes...
                      </div>
                    )}
                    {bulkReminderState.logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="border-b border-slate-800/45 pb-1 last:border-0 text-slate-300"
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed text-center font-bold">
                  ⚠️ Dispatching uses real-time API routes. Please do not close
                  this modal or refresh the webpage until all tenants have been
                  triggered successfully.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENT REMINDER MODAL (Free WhatsApp & SMS Portal) */}
      {reminderModal.isOpen && reminderModal.record && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-emerald-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                  <MessageSquare className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase leading-none tracking-tight">
                    Send Due Reminder
                  </h3>
                  <p className="text-[10px] font-bold text-white/70 uppercase mt-1.5">
                    Free Zero-Cost SMS & WhatsApp Protocol
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setReminderModal({ ...reminderModal, isOpen: false })
                }
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Recipient Info
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      Tenant Name
                    </p>
                    <p className="text-sm font-black text-slate-800 mt-1 uppercase">
                      {reminderModal.record.tenantName}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      Phone Number
                    </p>
                    <input
                      type="text"
                      value={reminderModal.phone}
                      onChange={(e) =>
                        setReminderModal({
                          ...reminderModal,
                          phone: e.target.value,
                        })
                      }
                      className="text-sm font-black text-slate-800 mt-1 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1 animate-in fade-in">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Message Template
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const pName =
                          reminderModal.record.property?.name || "Property";
                        const tName =
                          reminderModal.record.tenantName || "Tenant";
                        const rentVal = reminderModal.record.rentAmount
                          ? reminderModal.record.rentAmount.toLocaleString(
                              "en-IN",
                            )
                          : "0";
                        const msg = `Dear ${tName}, your rent of ₹${rentVal} for ${pName} (Month: ${selectedMonth}) is pending. Please pay at your earliest convenience. Thank you!`;
                        setReminderModal({ ...reminderModal, message: msg });
                      }}
                      className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 hover:underline bg-indigo-50 px-2 py-1 rounded"
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pName =
                          reminderModal.record.property?.name || "Property";
                        const tName =
                          reminderModal.record.tenantName || "Tenant";
                        const rentVal = reminderModal.record.rentAmount
                          ? reminderModal.record.rentAmount.toLocaleString(
                              "en-IN",
                            )
                          : "0";
                        const msg = `नमस्ते ${tName}, आपके ${pName} का ${selectedMonth} महीने का किराया ₹${rentVal} अभी तक लंबित है। कृपया जल्द से जल्द भुगतान सुनिश्चित करें। धन्यवाद!`;
                        setReminderModal({ ...reminderModal, message: msg });
                      }}
                      className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-700 hover:underline bg-emerald-50 px-2 py-1 rounded"
                    >
                      हिंदी
                    </button>
                  </div>
                </div>

                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-6 py-5 text-xs font-semibold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all min-h-[140px] shadow-inner text-slate-700 leading-relaxed font-sans"
                  placeholder="Write your reminder message..."
                  value={reminderModal.message}
                  onChange={(e) =>
                    setReminderModal({
                      ...reminderModal,
                      message: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => {
                    const cleanDigits = reminderModal.phone.replace(/\D/g, "");
                    const finalPhone =
                      cleanDigits.length === 10
                        ? `91${cleanDigits}`
                        : cleanDigits;
                    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(reminderModal.message)}`;
                    window.open(url, "_blank", "noreferrer,noopener");
                  }}
                  className="py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  💬 WhatsApp
                </button>
                <button
                  onClick={() => {
                    const isIos =
                      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
                      !(window as any).MSStream;
                    const separator = isIos ? "&" : "?";
                    const url = `sms:${reminderModal.phone}${separator}body=${encodeURIComponent(reminderModal.message)}`;
                    window.location.href = url;
                  }}
                  className="py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  ✉️ Send SMS
                </button>
              </div>

              {store.config?.whatsappAccessToken &&
                store.config?.whatsappPhoneID && (
                  <div className="pt-2 animate-in slide-in-from-bottom">
                    <button
                      disabled={metaSending}
                      onClick={handleSendIndividualMetaReminder}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {metaSending
                        ? "🚀 Sending template..."
                        : "🚀 Send via Official WhatsApp Cloud API"}
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RentCollection;
