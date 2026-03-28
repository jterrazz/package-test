import MockDatePackage from "mockdate";

export interface MockDatePort {
  reset: () => void;
  set: (date: Date | number | string) => void;
}

export const mockOfDate: MockDatePort = MockDatePackage;
