import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";

describe("MultiSelectDropdown component", () => {
  const options = ["Refrigerated", "Covered", "Open Bed", "Flatbed"];

  it("renders placeholder when no options selected", () => {
    const handleChange = vi.fn();
    render(
      <MultiSelectDropdown
        options={options}
        selected={[]}
        onChange={handleChange}
        placeholder="Select vehicle features"
      />
    );

    expect(screen.getByText("Select vehicle features")).toBeDefined();
  });

  it("renders count and selected badges when options are selected", () => {
    const handleChange = vi.fn();
    render(
      <MultiSelectDropdown
        options={options}
        selected={["Refrigerated", "Covered"]}
        onChange={handleChange}
        placeholder="Select vehicle features"
      />
    );

    expect(screen.getByText("2 selected")).toBeDefined();
    expect(screen.getByText("Refrigerated")).toBeDefined();
    expect(screen.getByText("Covered")).toBeDefined();
  });

  it("triggers onChange when removing a badge", () => {
    const handleChange = vi.fn();
    render(
      <MultiSelectDropdown
        options={options}
        selected={["Refrigerated", "Covered"]}
        onChange={handleChange}
        placeholder="Select vehicle features"
      />
    );

    const removeButton = screen.getByText("Remove Refrigerated");
    fireEvent.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith(["Covered"]);
  });
});
