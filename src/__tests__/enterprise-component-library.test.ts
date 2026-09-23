import {
  CurrencyInput,
  TagInput,
  AvatarGroup,
  AlertBox,
  Spinner,
  DescriptionList,
  ProgressCard,
  ActivityTimeline,
  BulkActionBar,
  ActionToolbar,
  FormField,
  FormSection,
  ModalForm,
  EntityCard,
} from "@/components/enterprise-ui";

describe("Enterprise Global Component Library (Master Prompt 004)", () => {
  it("exports all base input primitives correctly", () => {
    expect(CurrencyInput).toBeDefined();
    expect(TagInput).toBeDefined();
    expect(typeof TagInput).toBe("function");
    expect(AvatarGroup).toBeDefined();
    expect(typeof AvatarGroup).toBe("function");
    expect(AlertBox).toBeDefined();
    expect(typeof AlertBox).toBe("function");
    expect(Spinner).toBeDefined();
    expect(typeof Spinner).toBe("function");
  });

  it("exports all data display and timeline primitives correctly", () => {
    expect(DescriptionList).toBeDefined();
    expect(typeof DescriptionList).toBe("function");
    expect(ProgressCard).toBeDefined();
    expect(typeof ProgressCard).toBe("function");
    expect(ActivityTimeline).toBeDefined();
    expect(typeof ActivityTimeline).toBe("function");
  });

  it("exports all action and toolbar primitives correctly", () => {
    expect(BulkActionBar).toBeDefined();
    expect(typeof BulkActionBar).toBe("function");
    expect(ActionToolbar).toBeDefined();
    expect(typeof ActionToolbar).toBe("function");
  });

  it("exports all form and modal wrappers correctly", () => {
    expect(FormField).toBeDefined();
    expect(typeof FormField).toBe("function");
    expect(FormSection).toBeDefined();
    expect(typeof FormSection).toBe("function");
    expect(ModalForm).toBeDefined();
    expect(typeof ModalForm).toBe("function");
  });

  it("exports generic entity card components correctly", () => {
    expect(EntityCard).toBeDefined();
    expect(typeof EntityCard).toBe("function");
  });
});
