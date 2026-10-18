"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/shared/ui/command";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { key: string; module_key: string | null }[];
  placeholder?: string;
}

export function PermissionCombobox({ value, onChange, options, placeholder = "Nenhuma" }: Props) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => {
    const m = new Map<string, { key: string }[]>();
    for (const o of options) {
      const g = o.module_key ?? "outros";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(o);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between h-10 font-mono text-xs">
          {value || <span className="font-sans text-sm text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar permissão..." />
          <CommandList>
            <CommandEmpty>Nenhuma permissão encontrada</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Nenhuma</span>
              </CommandItem>
            </CommandGroup>
            {grouped.map(([mod, items]) => (
              <CommandGroup key={mod} heading={mod}>
                {items.map((o) => (
                  <CommandItem key={o.key} value={o.key}
                    onSelect={() => { onChange(o.key); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === o.key ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono text-xs">{o.key}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}