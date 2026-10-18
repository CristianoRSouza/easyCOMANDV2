"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/lib/utils";
import {
  Home, Store, Users, ShoppingCart, Package, CreditCard, BarChart3, Settings, Building2,
  Calendar, Mail, Bell, Shield, Truck, Star, Heart, Bookmark, Tag, Eye, Lock, Database,
  Cloud, Image, Zap, Target, Activity, FileText, Folder, Menu, Circle, Plus, LayoutList,
  FolderTree, Globe, Map, Landmark, LayoutDashboard, Boxes, Wallet, DollarSign, PiggyBank,
  TrendingUp, User, UserPlus, UserCog, PieChart, LineChart, Receipt, Warehouse, Phone,
  MapPin, Key, Clock, Search, ChevronDown,
} from "lucide-react";

const iconList = [
  { name: "Home", icon: Home }, { name: "LayoutDashboard", icon: LayoutDashboard },
  { name: "Store", icon: Store }, { name: "Users", icon: Users }, { name: "User", icon: User },
  { name: "UserPlus", icon: UserPlus }, { name: "UserCog", icon: UserCog },
  { name: "ShoppingCart", icon: ShoppingCart }, { name: "Package", icon: Package },
  { name: "Boxes", icon: Boxes }, { name: "CreditCard", icon: CreditCard },
  { name: "Wallet", icon: Wallet }, { name: "DollarSign", icon: DollarSign },
  { name: "PiggyBank", icon: PiggyBank }, { name: "Receipt", icon: Receipt },
  { name: "BarChart3", icon: BarChart3 }, { name: "PieChart", icon: PieChart },
  { name: "LineChart", icon: LineChart }, { name: "TrendingUp", icon: TrendingUp },
  { name: "Activity", icon: Activity }, { name: "Settings", icon: Settings },
  { name: "Building2", icon: Building2 }, { name: "Warehouse", icon: Warehouse },
  { name: "Calendar", icon: Calendar }, { name: "Clock", icon: Clock },
  { name: "Mail", icon: Mail }, { name: "Phone", icon: Phone }, { name: "Bell", icon: Bell },
  { name: "Shield", icon: Shield }, { name: "Lock", icon: Lock }, { name: "Key", icon: Key },
  { name: "Truck", icon: Truck }, { name: "Star", icon: Star }, { name: "Heart", icon: Heart },
  { name: "Bookmark", icon: Bookmark }, { name: "Tag", icon: Tag }, { name: "Eye", icon: Eye },
  { name: "Database", icon: Database }, { name: "Cloud", icon: Cloud }, { name: "Image", icon: Image },
  { name: "Zap", icon: Zap }, { name: "Target", icon: Target }, { name: "FileText", icon: FileText },
  { name: "Folder", icon: Folder }, { name: "FolderTree", icon: FolderTree },
  { name: "Menu", icon: Menu }, { name: "LayoutList", icon: LayoutList },
  { name: "Globe", icon: Globe }, { name: "Map", icon: Map }, { name: "MapPin", icon: MapPin },
  { name: "Landmark", icon: Landmark }, { name: "Circle", icon: Circle },
];

export const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  iconList.map((i) => [i.name, i.icon]),
);

export function getIconComponent(iconName: string | null | undefined): React.ElementType {
  if (!iconName) return Circle;
  return ICON_MAP[iconName] || Circle;
}

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  placeholder?: string;
}

export function IconPicker({ value, onChange, placeholder = "Selecionar ícone" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = iconList.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const Selected = ICON_MAP[value] || Circle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-10">
          <span className="flex items-center gap-2">
            {value ? (
              <>
                <Selected className="w-4 h-4 text-primary" />
                <span className="text-sm">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ícone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="grid grid-cols-5 gap-1 p-2">
            {filtered.map((item) => {
              const I = item.icon;
              const sel = value === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => { onChange(item.name); setOpen(false); setSearch(""); }}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-all hover:bg-accent",
                    sel && "bg-primary/10 text-primary ring-1 ring-primary/30",
                  )}
                  title={item.name}
                >
                  <I className="w-5 h-5" />
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum ícone</div>
          )}
        </ScrollArea>
        {value && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}>
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}