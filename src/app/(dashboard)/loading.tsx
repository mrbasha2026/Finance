export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full gap-6 py-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dealztree.png"
        alt="DealzTree"
        style={{ width: 160, height: 60, objectFit: "contain" }}
      />
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-[#9fc552] animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
