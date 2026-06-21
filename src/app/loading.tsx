export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dealztree.png"
        alt="DealzTree"
        style={{ width: 180, height: 70, objectFit: "contain" }}
      />
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
