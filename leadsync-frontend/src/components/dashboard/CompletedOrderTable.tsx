import { Order } from "../../types";

interface Props {
  orders: Order[];
}

export default function CompletedOrderTable({ orders }: Props) {
  if (orders.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
          <tr>
            <th className="p-4">Completed Date</th>
            <th className="p-4">Summary</th>
            <th className="p-4">Customer</th>
            <th className="p-4">Amount</th>
            <th className="p-4">Status</th>
            <th className="p-4">Agent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map(order => (
             <tr key={order.id} className="hover:bg-slate-50 transition">
               <td className="p-4 text-slate-500 whitespace-nowrap">
                 {order.completedAt ? new Date(order.completedAt).toLocaleDateString() : 'N/A'}
               </td>
               <td className="p-4 font-bold text-slate-800">{order.summary}</td>
               <td className="p-4 text-slate-700">{order.lead?.name || '---'}</td>
               <td className="p-4 font-black">₹{order.amount.toLocaleString()}</td>
               <td className="p-4">
                 <span className="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px]">
                   {order.status}
                 </span>
               </td>
               <td className="p-4 text-slate-700">{order.processedBy?.name || '---'}</td>
             </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
