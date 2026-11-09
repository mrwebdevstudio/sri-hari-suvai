type IconName = "search" | "person" | "truck" | "list" | "x-lg" | "chevron-right" | "chevron-left" | "flower2" | "cup-hot" | "basket2" | "leaf" | "envelope" | "bag" | "box-seam" | "story-leaf" | "story-mortar" | "story-sprout" | "story-rosette";

export function StoreIcon({ name }: { name: IconName }) {
  return <svg className="store-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href={`/brand/store-icons.svg#${name}`} /></svg>;
}
