import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface MultiSelectDropdownProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  badgeClassName?: string;
}

export function MultiSelectDropdown({
  options,
  selected = [],
  onChange,
  placeholder = "Select options...",
  className,
  badgeClassName,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  const handleSelectAll = () => {
    onChange([...options]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className={cn("space-y-2 w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[40px] h-auto px-3 py-2 text-left font-normal bg-background hover:bg-background/80"
          >
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 pr-2">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <span className="text-sm font-medium">
                  {selected.length} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selected.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      handleClearAll();
                    }
                  }}
                  className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear all"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border/40">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="hover:text-foreground hover:underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-foreground hover:underline"
                >
                  Clear All
                </button>
              </div>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {options.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => handleToggle(option)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selected.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className={cn("gap-1 py-1 px-2.5 text-xs font-normal", badgeClassName)}
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove {item}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
