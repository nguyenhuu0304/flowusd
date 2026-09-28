"use client";

import {
  CheckCircle2,
  Clock3,
} from "lucide-react";

type Props = {
  status: "completed" | "pending";
};

export default function TransactionStatus({
  status,
}: Props) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 size={14} />
        Completed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
      <Clock3 size={14} />
      Pending
    </span>
  );
}