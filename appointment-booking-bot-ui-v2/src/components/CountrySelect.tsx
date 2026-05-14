import { useState, useRef, useEffect } from "react";
import { FlagComponent } from "country-flag-icons/react/3x2";
import * as Flags from "country-flag-icons/react/3x2";
import { MOST_USED_COUNTRIES, ALL_COUNTRIES, type Country } from "@/data/countries";

interface Props {
  value: string;
  onChange: (apiValue: string, code: string) => void;
  placeholder?: string;
}

function Flag({ code }: { code: string }) {
  const Comp = (Flags as Record<string, FlagComponent>)[code];
  if (!Comp) return <span className="w-5 h-3.5 bg-muted rounded-sm inline-block" />;
  return <Comp className="w-5 h-3.5 rounded-sm flex-shrink-0" />;
}

export function CountrySelect({ value, onChange, placeholder = "Select country" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const allUnique = ALL_COUNTRIES.filter(
    (c) => !MOST_USED_COUNTRIES.some((m) => m.code === c.code),
  );

  const filter = (list: Country[]) =>
    search ? list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : list;

  const mostUsedFiltered = filter(MOST_USED_COUNTRIES);
  const restFiltered = filter(allUnique);

  const selected =
    [...MOST_USED_COUNTRIES, ...ALL_COUNTRIES].find((c) => c.apiValue === value || c.code === value) ?? null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field flex items-center gap-2 cursor-pointer text-left"
      >
        {selected ? (
          <>
            <Flag code={selected.code} />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <span className="ml-auto text-muted-foreground text-xs">&#9660;</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              className="input-field text-xs py-1.5"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {mostUsedFiltered.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-muted-foreground font-medium bg-accent/30">
                  Most Used
                </div>
                {mostUsedFiltered.map((c) => (
                  <CountryOption
                    key={c.apiValue}
                    country={c}
                    selected={value === c.apiValue}
                    onSelect={() => { onChange(c.apiValue, c.code); setOpen(false); setSearch(""); }}
                  />
                ))}
                {restFiltered.length > 0 && (
                  <div className="px-3 py-1 text-xs text-muted-foreground font-medium bg-accent/30">
                    All Countries
                  </div>
                )}
              </>
            )}
            {restFiltered.map((c) => (
              <CountryOption
                key={c.apiValue}
                country={c}
                selected={value === c.apiValue}
                onSelect={() => { onChange(c.apiValue, c.code); setOpen(false); setSearch(""); }}
              />
            ))}
            {mostUsedFiltered.length === 0 && restFiltered.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground text-center">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryOption({ country, selected, onSelect }: { country: Country; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors ${selected ? "bg-primary/10 text-primary" : "text-foreground"}`}
    >
      <Flag code={country.code} />
      <span>{country.name}</span>
    </button>
  );
}
