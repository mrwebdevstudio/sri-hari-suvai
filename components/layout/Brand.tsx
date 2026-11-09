import Image from "next/image";
import Link from "next/link";
import wordmark from "@/public/brand/wordmark.webp";

export function Brand({ eager = false }: { eager?: boolean }) {
  const loading = eager ? "eager" : "lazy";
  return (
    <Link className="store-brand" href="/" aria-label="Sri Hari Suvai home">
      <Image className="brand-mark" src="/brand/spice-mark.png" width={130} height={160} loading={loading} unoptimized={eager} alt="" />
      <span className="brand-type">
        <Image src={wordmark} loading={loading} unoptimized={eager} sizes="(max-width: 720px) 131px, 226px" alt="Sri Hari Suvai" />
        <small>Dry mix and spice varieties</small>
      </span>
    </Link>
  );
}
