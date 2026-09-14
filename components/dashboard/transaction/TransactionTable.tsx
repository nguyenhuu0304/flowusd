"use client";

import Card from "@/components/ui/Card";

import TransactionRow from "./TransactionRow";

import type { Transaction } from "@/types/transaction";

type Props = {
  transactions: Transaction[];
  emptyMessage?: string;
  showView?: boolean;
};

export default function TransactionTable({
  transactions,
  emptyMessage = "No transactions found.",
  showView = false,
}: Props) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-slate-500">
              <th className="pb-3">
                Transaction
              </th>

              <th className="pb-3">
                Date
              </th>

              <th className="pb-3">
                Status
              </th>

              <th className="pb-3 text-right">
                Amount
              </th>

              {showView && (
                <th className="pb-3 text-right">
                  Action
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    showView ? 5 : 4
                  }
                  className="py-10 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  showView={showView}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}