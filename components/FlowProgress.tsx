const FLOW_STEPS = ["본인확인", "위치확인", "사진인증", "적립완료"] as const;

type FlowProgressProps = {
  current: number;
};

export function FlowProgress({ current }: FlowProgressProps) {
  return (
    <div className="flow-progress" aria-label={`전체 4단계 중 ${current}단계`}>
      <div className="progress-meta">
        <span>체크인 진행</span>
        <strong>{current}/4</strong>
      </div>
      <ol>
        {FLOW_STEPS.map((label, index) => {
          const step = index + 1;
          const status = step < current ? "complete" : step === current ? "current" : "pending";
          return (
            <li className={status} key={label} aria-current={status === "current" ? "step" : undefined}>
              <span>{status === "complete" ? "✓" : step}</span>
              <small>{label}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
