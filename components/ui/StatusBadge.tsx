type Status =
  | "completed"
  | "pending"
  | "failed"
  | "connected"
  | "success"
  | "warning";

type Props = {
  status: Status;
};

const styles: Record<
  Status,
  {
    label: string;
    className: string;
  }
> = {
  completed: {
    label: "Completed",
    className:
      "bg-green-100 text-green-700 border-green-200",
  },

  pending: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-700 border-yellow-200",
  },

  failed: {
    label: "Failed",
    className:
      "bg-red-100 text-red-700 border-red-200",
  },

  connected: {
    label: "Connected",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200",
  },

  success: {
    label: "Success",
    className:
      "bg-green-100 text-green-700 border-green-200",
  },

  warning: {
    label: "Warning",
    className:
      "bg-orange-100 text-orange-700 border-orange-200",
  },
};

export default function StatusBadge({
  status,
}: Props) {
  const config = styles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}