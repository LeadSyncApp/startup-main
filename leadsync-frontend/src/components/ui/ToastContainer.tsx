import { Toaster } from "react-hot-toast";

export default function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#161922",
          color: "#F8FAFC",
          borderRadius: "12px",
          border: "1px solid #2A2F3A",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
        },
        success: {
          style: {
            border: "1px solid rgba(34, 197, 94, 0.3)",
          },
          iconTheme: {
            primary: "#22C55E",
            secondary: "#161922",
          },
        },
        error: {
          style: {
            border: "1px solid rgba(239, 68, 68, 0.3)",
          },
          iconTheme: {
            primary: "#EF4444",
            secondary: "#161922",
          },
        },
      }}
    />
  );
}
