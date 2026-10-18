"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { cn } from "@/shared/lib/utils";
import type { StoreLite } from "@/modules/pix/infrastructure/use-stores";

export function StoreCombobox({
  stores,
  value,
  onChange,
}: {
  stores: StoreLite[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = stores.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected
              ? `${selected.name}${selected.cnpj ? ` · ${selected.cnpj}` : ""}`
              : "Selecione a loja"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const term = search.toLowerCase().replace(/[^\w]/g, "");
            if (!term) return 1;
            const haystack = itemValue.toLowerCase().replace(/[^\w]/g, "");
            return haystack.includes(term) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por CNPJ ou razão social..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhuma loja encontrada.</CommandEmpty>
            <CommandGroup>
              {stores.map((s) => (
                <CommandItem
                  key={s.id}
                  value={[s.name, s.legal_name, s.cnpj, s.company_name].filter(Boolean).join(" ")}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{s.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[s.legal_name, s.cnpj].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
