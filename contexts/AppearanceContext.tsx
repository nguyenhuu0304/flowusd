
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type FlowTheme = "light" | "dark";
export type FlowLanguage = "en" | "vi";

const THEME_KEY = "flowusd:theme";
const LANGUAGE_KEY = "flowusd:language";

const translations = {
  en: {
    dashboard: "Dashboard",
    paymentLinks: "Payment Links",
    transactions: "Transactions",
    connectWallet: "Connect Wallet",
    connectedWallet: "Connected Wallet",
    disconnectWallet: "Disconnect Wallet",
    selectWallet: "Select a wallet",
    walletAddress: "Wallet Address",
    usdcBalance: "On-chain USDC Balance",
    connected: "Connected",
    disconnected: "Not Connected",
    wrongNetwork: "Wrong Network",
    refresh: "Refresh",
    copyAddress: "Copy Address",
    copied: "Copied",
    viewExplorer: "View on Arc Explorer",
    loading: "Loading...",
    light: "Light",
    dark: "Dark",
    language: "Language",
    appearance: "Appearance",
    paymentDescription:
      "Manage your USDC payments on Arc Testnet.",
    createPaymentLink: "Create a Payment Link",
    yourPaymentLinks: "Your Payment Links",
    amount: "Amount",
    description: "Description",
    optional: "Optional",
    createLink: "Create On-chain Link",
    paid: "Paid",
    unpaid: "Unpaid",
    copyLink: "Copy Link",
    showQr: "Show QR",
    hideQr: "Hide QR",
    downloadQr: "Download QR",
    open: "Open",
    transactionHistory: "Transaction History",
    received: "Received",
    sent: "Sent",
    all: "All",
    date: "Date",
    status: "Status",
    action: "Action",
    confirmed: "Confirmed",
    pending: "Pending",
    failed: "Failed",
    loadOlder: "Load Older Transactions",
    noTransactions: "No transactions found in scanned blocks.",
    noLinks: "No payment links found for this wallet.",
  },
  vi: {
    dashboard: "Trang chủ",
    paymentLinks: "Liên kết thanh toán",
    transactions: "Lịch sử giao dịch",
    connectWallet: "Kết nối ví",
    connectedWallet: "Ví đã kết nối",
    disconnectWallet: "Ngắt kết nối ví",
    selectWallet: "Chọn ví",
    walletAddress: "Địa chỉ ví",
    usdcBalance: "Số dư USDC trên blockchain",
    connected: "Đã kết nối",
    disconnected: "Chưa kết nối",
    wrongNetwork: "Sai mạng",
    refresh: "Làm mới",
    copyAddress: "Sao chép địa chỉ",
    copied: "Đã sao chép",
    viewExplorer: "Xem trên Arc Explorer",
    loading: "Đang tải...",
    light: "Sáng",
    dark: "Tối",
    language: "Ngôn ngữ",
    appearance: "Giao diện",
    paymentDescription:
      "Quản lý thanh toán USDC trên Arc Testnet.",
    createPaymentLink: "Tạo liên kết thanh toán",
    yourPaymentLinks: "Liên kết thanh toán của bạn",
    amount: "Số tiền",
    description: "Mô tả",
    optional: "Không bắt buộc",
    createLink: "Tạo liên kết trên blockchain",
    paid: "Đã thanh toán",
    unpaid: "Chưa thanh toán",
    copyLink: "Sao chép liên kết",
    showQr: "Hiện mã QR",
    hideQr: "Ẩn mã QR",
    downloadQr: "Tải mã QR",
    open: "Mở",
    transactionHistory: "Lịch sử giao dịch",
    received: "Đã nhận",
    sent: "Đã gửi",
    all: "Tất cả",
    date: "Ngày",
    status: "Trạng thái",
    action: "Thao tác",
    confirmed: "Đã xác nhận",
    pending: "Đang chờ",
    failed: "Thất bại",
    loadOlder: "Tải giao dịch cũ hơn",
    noTransactions:
      "Không tìm thấy giao dịch trong khoảng block đã quét.",
    noLinks: "Không tìm thấy liên kết thanh toán của ví này.",
  },
} as const;

export type TranslationKey =
  keyof typeof translations.en;

type AppearanceContextValue = {
  theme: FlowTheme;
  language: FlowLanguage;
  setTheme: (value: FlowTheme) => void;
  setLanguage: (value: FlowLanguage) => void;
  t: (key: TranslationKey) => string;
};

const AppearanceContext =
  createContext<AppearanceContextValue | null>(null);

function applyTheme(theme: FlowTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle(
    "dark",
    theme === "dark"
  );

  document.documentElement.style.colorScheme = theme;
}

export function AppearanceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, updateTheme] =
    useState<FlowTheme>("light");

  const [language, updateLanguage] =
    useState<FlowLanguage>("en");

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);

    const initialTheme: FlowTheme =
      savedTheme === "dark" ? "dark" : "light";

    const initialLanguage: FlowLanguage =
      savedLanguage === "vi" ? "vi" : "en";

    updateTheme(initialTheme);
    updateLanguage(initialLanguage);
    applyTheme(initialTheme);
    document.documentElement.lang = initialLanguage;
  }, []);

  const setTheme = useCallback((value: FlowTheme) => {
    updateTheme(value);
    localStorage.setItem(THEME_KEY, value);
    applyTheme(value);
  }, []);

  const setLanguage = useCallback(
    (value: FlowLanguage) => {
      updateLanguage(value);
      localStorage.setItem(LANGUAGE_KEY, value);
      document.documentElement.lang = value;
    },
    []
  );

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key];
    },
    [language]
  );

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        language,
        setTheme,
        setLanguage,
        t,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);

  if (!context) {
    throw new Error(
      "useAppearance must be used inside AppearanceProvider."
    );
  }

  return context;
}
