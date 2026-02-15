import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

export default function Reports() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Reports
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Placeholder for analytics and reports.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Overview
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reports and exports will appear here.
            </p>
          </div>
          <div className="rounded-lg bg-cyan-100 p-3">
            <BarChart3 className="h-5 w-5 text-cyan-600" />
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-500">
          No reports generated yet.
        </div>
      </div>
    </motion.div>
  );
}
