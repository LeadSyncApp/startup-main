import { Toaster } from "react-hot-toast";

export default function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--app-surface)",
          color: "var(--app-text)",
          border: "1px solid var(--app-border)",
          borderRadius: "12px",
          boxShadow: "var(--app-shadow-lg)",
        },
      }}
    />
  );
}
