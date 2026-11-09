"use client";

import { useState, type KeyboardEvent } from "react";
import type { Product } from "@/lib/products";

type ProductSearchProps = {
  id: string;
  placeholder: string;
  query: string;
  matches: readonly Product[];
  onQueryChange: (value: string) => void;
};

export function ProductSearch({ id, placeholder, query, matches, onQueryChange }: ProductSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const term = query.trim().toLowerCase();
  const suggestions = expanded && term ? matches.slice(0, 5) : [];
  const open = suggestions.length > 0;
  const active = suggestions[activeIndex];
  const listId = id + "-suggestions";

  function close() {
    setExpanded(false);
    setActiveIndex(-1);
  }

  function choose(product: Product) {
    onQueryChange(product.name);
    close();
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      choose(active);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && term && matches.length) {
      event.preventDefault();
      setExpanded(true);
      const count = Math.min(matches.length, 5);
      if (event.key === "ArrowDown") setActiveIndex((activeIndex + 1) % count);
      else setActiveIndex(activeIndex <= 0 ? count - 1 : activeIndex - 1);
    }
  }

  return (
    <div className="product-search search-field">
      <label htmlFor={id}>Search products</label>
      <input
        id={id} type="search" role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={active ? listId + "-" + active.slug : undefined}
        value={query} placeholder={placeholder}
        onChange={event => { onQueryChange(event.target.value); setActiveIndex(-1); setExpanded(true); }}
        onFocus={() => setExpanded(true)} onBlur={close} onKeyDown={handleKey}
      />
      {open && (
        <ul id={listId} className="product-suggestions" role="listbox" aria-label="Suggested products"
          onMouseDown={event => event.preventDefault()}>
          {suggestions.map(product => (
            <li key={product.slug} id={listId + "-" + product.slug} role="option"
              aria-selected={product === active} onClick={() => choose(product)}>
              {product.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
