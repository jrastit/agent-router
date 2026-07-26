import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PresentationDeck, {
  presentationDurationSeconds,
  presentationSlides,
} from "./presentation-deck";

describe("hackathon presentation", () => {
  it("defines a 4–5 minute narrative with every sponsor and the stack", () => {
    expect(presentationDurationSeconds).toBe(270);
    expect(presentationSlides).toHaveLength(9);
    expect(presentationSlides.map((slide) => slide.label)).toEqual(
      expect.arrayContaining([
        "Route before spending",
        "Why blockchain payment",
        "Hedera",
        "0G",
        "The Graph",
        "Technical stack",
      ]),
    );
  });

  it("renders the opening slide and presentation controls", () => {
    const html = renderToStaticMarkup(<PresentationDeck />);

    expect(html).toContain("The economic control plane");
    expect(html).toContain("4:30 hackathon deck");
    expect(html).toContain("Fullscreen");
    expect(html).toContain("Slide 1 of 9");
    expect(html).toContain("Next slide");
  });
});
