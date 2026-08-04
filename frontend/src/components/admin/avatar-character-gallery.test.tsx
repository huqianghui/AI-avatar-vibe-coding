import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AVATAR_CHARACTERS } from "@/data/avatar-characters";
import { AvatarCharacterGallery } from "./avatar-character-gallery";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function totalItems(filter: "all" | "photo" | "video" = "all") {
  return AVATAR_CHARACTERS.reduce((acc, c) => {
    if (c.isPhotoAvatar) {
      return filter === "video" ? acc : acc + 1;
    }
    return filter === "photo" ? acc : acc + c.styles.length;
  }, 0);
}

const firstVideoAvatar = AVATAR_CHARACTERS.find((c) => !c.isPhotoAvatar)!;
const firstPhotoAvatar = AVATAR_CHARACTERS.find((c) => c.isPhotoAvatar)!;

describe("AvatarCharacterGallery", () => {
  it("renders one grid item per style-variant of every video avatar plus one item per photo avatar", () => {
    render(
      <AvatarCharacterGallery character="lisa" style="casual-sitting" onSelect={vi.fn()} />,
    );
    const grid = screen.getByTestId("avatar-character-grid");
    expect(within(grid).getAllByRole("button")).toHaveLength(totalItems("all"));
  });

  it("calls onSelect with characterId/style for the clicked item (empty style for photo avatars)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AvatarCharacterGallery character="" style="" onSelect={onSelect} />);
    const grid = screen.getByTestId("avatar-character-grid");

    const videoItem = within(grid).getByRole("button", {
      name: new RegExp(
        `^${firstVideoAvatar.displayName}\\s*\\(${firstVideoAvatar.styles[0]!.replace(/-/g, " ")}\\)$`,
        "i",
      ),
    });
    await user.click(videoItem);
    expect(onSelect).toHaveBeenCalledWith(firstVideoAvatar.id, firstVideoAvatar.styles[0]);

    const photoItem = within(grid).getByRole("button", {
      name: new RegExp(`^${firstPhotoAvatar.displayName}$`, "i"),
    });
    await user.click(photoItem);
    expect(onSelect).toHaveBeenCalledWith(firstPhotoAvatar.id, "");
  });

  it("renders the currently-selected item with the selected ring/border class", () => {
    render(
      <AvatarCharacterGallery
        character={firstVideoAvatar.id}
        style={firstVideoAvatar.styles[0]!}
        onSelect={vi.fn()}
      />,
    );
    const grid = screen.getByTestId("avatar-character-grid");
    const selectedItem = within(grid).getByRole("button", {
      name: new RegExp(
        `^${firstVideoAvatar.displayName}\\s*\\(${firstVideoAvatar.styles[0]!.replace(/-/g, " ")}\\)$`,
        "i",
      ),
    });
    expect(selectedItem.className).toContain("ring-2");
    expect(selectedItem.className).toContain("border-primary");

    const otherItem = within(grid).getByRole("button", {
      name: new RegExp(`^${firstPhotoAvatar.displayName}$`, "i"),
    });
    expect(otherItem.className).not.toContain("ring-2");
  });

  it("filters to only photo avatars when the photo filter is clicked, and only video avatars for video", async () => {
    const user = userEvent.setup();
    render(<AvatarCharacterGallery character="" style="" onSelect={vi.fn()} />);
    const grid = screen.getByTestId("avatar-character-grid");

    await user.click(screen.getByText("voiceLive.vlDialogFilterPhoto"));
    expect(within(grid).getAllByRole("button")).toHaveLength(totalItems("photo"));

    await user.click(screen.getByText("voiceLive.vlDialogFilterVideo"));
    expect(within(grid).getAllByRole("button")).toHaveLength(totalItems("video"));

    await user.click(screen.getByText("voiceLive.vlDialogFilterAll"));
    expect(within(grid).getAllByRole("button")).toHaveLength(totalItems("all"));
  });

  it("swaps only the failed thumbnail to the initials fallback, leaving other items' images intact", () => {
    render(<AvatarCharacterGallery character="" style="" onSelect={vi.fn()} />);
    const grid = screen.getByTestId("avatar-character-grid");
    const imagesBefore = within(grid).getAllByRole("img");
    expect(imagesBefore.length).toBeGreaterThan(1);

    fireEvent.error(imagesBefore[0]!);

    const imagesAfter = within(grid).getAllByRole("img");
    expect(imagesAfter.length).toBe(imagesBefore.length - 1);
  });
});
