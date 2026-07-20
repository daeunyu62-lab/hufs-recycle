import { SubmissionStatus } from "@/lib/api";

const labels: Record<SubmissionStatus, string> = {
  PENDING: "검토 대기",
  APPROVED: "승인",
  REJECTED: "거절",
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{labels[status]}</span>;
}
