import Image from "next/image";
import Link from "next/link";
import { StoreIcon } from "@/components/ui/StoreIcon";

const ranges = [
  { key: "instant", name: "Instant Mix", description: ["Quick, easy & tasty meals", "in minutes"] },
  { key: "direct", name: "Direct Mix", description: ["All-purpose, traditional", "podis for everyday use"] },
];

export function RangeLinks() {
  return (
    <div className="range-grid">
      {ranges.map(range => {
        const photo = "/images/storefront/ranges/" + range.key;
        return (
          <Link className={`range-panel range-${range.key}`} key={range.key} href={`/shop?range=${range.key}`} aria-label={`Shop ${range.name}`}>
            <picture className="range-photo">
              <source srcSet={`${photo}-800.webp 800w, ${photo}-2040.webp 2040w`} sizes="(max-width: 720px) 92vw, (min-width: 1550px) 700px, 45vw" />
              <Image src={photo + "-800.webp"} alt="" fill unoptimized />
            </picture>
            <div className="range-copy">
              <h3>{range.name}</h3>
              <p>{range.description[0]}<br />{range.description[1]}</p>
              <span className="range-button">Shop {range.name} <StoreIcon name="chevron-right" /></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
