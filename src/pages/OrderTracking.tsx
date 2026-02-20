import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Package, Truck, AlertCircle } from "lucide-react";
import Confetti from "react-confetti";
import { motion } from "framer-motion";

const STATUS_STEPS = [
    { key: "PROCESSING", label: "Confirmed", icon: Check },
    { key: "PREPARING", label: "Preparing", icon: Package },
    { key: "SHIPPED", label: "On the Way", icon: Truck },
    { key: "DELIVERED", label: "Delivered", icon: Check },
];

export default function OrderTracking() {
    const { id } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // Use the public endpoint (no auth required)
                // Adjust api.get to NOT require auth if strictly public, 
                // but 'api' client might attach token if present. 
                // For public pages, we should use a raw fetch or ensure api client handles no-token.
                // Assuming api client is fine or we use fetch.
                // Let's use fetch to be safe and avoid AuthContext dependency issues if strictly public.
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/public/orders/${id}`);
                if (!res.ok) throw new Error("Order not found");
                const data = await res.json();
                setOrder(data);
            } catch (err) {
                setError("Order not found or invalid link.");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchOrder();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (error || !order) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Tracking Unavailable</h1>
            <p className="text-slate-500 mt-2">{error}</p>
        </div>
    );

    // Determine active step index
    // Legacy mappings included
    const statusMap: Record<string, number> = {
        "BOT_CREATED_ORDER": -1, // Should not happen publicly
        "NEW": 0,
        "PENDING": 0,
        "CONFIRMED": 0,
        "PROCESSING": 0,
        "PREPARING": 1,
        "READY": 1,
        "SHIPPED": 2,
        "DELIVERED": 3,
        "COMPLETED": 3,
    };

    const activeStep = statusMap[order.status] ?? 0;
    const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            {order.status === "DELIVERED" && <Confetti numberOfPieces={200} recycle={false} />}

            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">

                {/* Header */}
                <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-20"
                        style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 10%)', backgroundSize: '20px 20px' }} />

                    <h1 className="text-white text-lg font-medium opacity-90 relative z-10">Order Tracking</h1>
                    <div className="mt-4 relative z-10">
                        <h2 className="text-3xl font-black text-white">
                            {isCancelled ? "Cancelled" : order.status.replace(/_/g, " ")}
                        </h2>
                        <p className="text-indigo-200 text-sm mt-1 font-mono">#{order.id.slice(0, 8)}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-100">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                            <p className="font-bold text-slate-900 text-lg">{order.lead?.name || "Guest"}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</p>
                            <p className="font-bold text-slate-900 text-lg">₹{order.amount}</p>
                        </div>
                    </div>

                    {/* Stepper */}
                    {!isCancelled && (
                        <div className="space-y-8 relative">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-2 bottom-6 w-0.5 bg-slate-100 -z-10" />

                            {STATUS_STEPS.map((step, index) => {
                                const isActive = index <= activeStep;
                                const isCurrent = index === activeStep;
                                const Icon = step.icon;

                                return (
                                    <motion.div
                                        key={step.key}
                                        initial={{ exclude: true, opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`flex items-center gap-4 ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}
                                    >
                                        <div className={`
                        h-12 w-12 rounded-full flex items-center justify-center border-4 transition-all z-10
                        ${isActive
                                                ? `bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-500/30 ${isCurrent ? 'scale-110 ring-4 ring-indigo-50' : ''}`
                                                : 'bg-white border-slate-100 text-slate-300'}
                      `}>
                                            <Icon size={isCurrent ? 24 : 18} />
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-sm ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {step.label}
                                            </h3>
                                            {isCurrent && (
                                                <p className="text-xs text-indigo-500 font-medium mt-0.5">
                                                    Current Status
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}

                    {isCancelled && (
                        <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-center text-sm font-bold border border-rose-100">
                            This order has been cancelled.
                        </div>
                    )}

                    <div className="mt-10 pt-6 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Order Summary</h4>
                        <p className="text-slate-700 font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm leading-relaxed">
                            {order.summary}
                        </p>
                    </div>

                    <div className="mt-8 text-center">
                        <a href="/" className="text-indigo-600 font-bold text-sm hover:underline">
                            Need Help? Contact Support
                        </a>
                    </div>

                </div>
            </div>

            <p className="text-center text-slate-400 text-xs mt-8">
                Powered by LeadSync
            </p>
        </div>
    );
}
